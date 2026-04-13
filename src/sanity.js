import { createClient } from "@sanity/client";
import { seedState } from "./data";

const sanityConfig = {
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID,
  dataset: import.meta.env.VITE_SANITY_DATASET,
  apiVersion: "2025-01-01",
  useCdn: false,
  token: import.meta.env.VITE_SANITY_API_TOKEN,
};

export const hasSanityConfig = Boolean(
  sanityConfig.projectId && sanityConfig.dataset && sanityConfig.token,
);

const client = hasSanityConfig ? createClient(sanityConfig) : null;

const shopQuery = `{
  "products": *[_type == "product"] | order(featured desc, _createdAt desc) {
    _id,
    name,
    club,
    league,
    category,
    price,
    stock,
    status,
    featured,
    image,
    description
  },
  "users": *[_type == "userProfile"] | order(name asc) {
    _id,
    clerkId,
    name,
    email,
    city,
    role,
    totalSpent,
    ordersCount
  },
  "orders": *[_type == "order"] | order(orderDate desc) {
    _id,
    orderNumber,
    clerkId,
    customerName,
    customerEmail,
    customerCity,
    total,
    status,
    orderDate,
    items[] {
      productId,
      productName,
      club,
      image,
      price,
      quantity,
      lineTotal
    }
  }
}`;

function requireClient() {
  if (!client) {
    throw new Error("Sanity client ni konfiguriran.");
  }

  return client;
}

function inferCategory(product) {
  const text = `${product.name || ""} ${product.league || ""} ${product.club || ""}`.toLowerCase();
  if (text.includes("nba") || text.includes("basket")) {
    return "Basketball";
  }
  if (text.includes("lifestyle") || text.includes("street")) {
    return "Lifestyle";
  }
  return "Football";
}

function productDoc(product, id = product.id) {
  return {
    _id: id || `product.${Date.now()}`,
    _type: "product",
    name: product.name,
    club: product.club,
    league: product.league,
    category: product.category || inferCategory(product),
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    status: product.status || "Aktiven",
    featured: Boolean(product.featured),
    image:
      product.image ||
      "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80",
    description: product.description || "",
  };
}

function normalizeProduct(product) {
  return {
    id: product._id,
    name: product.name || "",
    club: product.club || "",
    league: product.league || "",
    category: product.category || inferCategory(product),
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    status: product.status || "Aktiven",
    featured: Boolean(product.featured),
    image:
      product.image ||
      "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?auto=format&fit=crop&w=1200&q=80",
    description: product.description || "",
  };
}

function normalizeUser(profile) {
  return {
    id: profile._id,
    clerkId: profile.clerkId || "",
    name: profile.name || "",
    email: profile.email || "",
    city: profile.city || "",
    role: profile.role || "user",
    totalSpent: Number(profile.totalSpent || 0),
    ordersCount: Number(profile.ordersCount || 0),
  };
}

function normalizeOrder(order) {
  return {
    id: order._id,
    orderNumber: order.orderNumber || "",
    clerkId: order.clerkId || "",
    customerName: order.customerName || "",
    customerEmail: order.customerEmail || "",
    customerCity: order.customerCity || "",
    total: Number(order.total || 0),
    status: order.status || "Placed",
    orderDate: order.orderDate || new Date().toISOString(),
    items: (order.items || []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      club: item.club,
      image: item.image,
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 0),
      lineTotal: Number(item.lineTotal || 0),
    })),
  };
}

async function seedProductsIfNeeded() {
  const api = requireClient();
  const count = await api.fetch("count(*[_type == 'product'])");

  if (count > 0) {
    return;
  }

  await Promise.all(
    seedState.products.map((product) =>
      api.createOrReplace(productDoc({ ...product, category: inferCategory(product) }, `product.${product.id}`)),
    ),
  );
}

export async function fetchShopData() {
  const api = requireClient();
  await seedProductsIfNeeded();
  const data = await api.fetch(shopQuery);

  return {
    products: (data.products || []).map(normalizeProduct),
    users: (data.users || []).map(normalizeUser),
    orders: (data.orders || []).map(normalizeOrder),
  };
}

export async function ensureUserProfile(user) {
  const api = requireClient();
  const docId = `userProfile.${user.id}`;

  await api.createIfNotExists({
    _id: docId,
    _type: "userProfile",
    clerkId: user.id,
    email: user.primaryEmailAddress?.emailAddress || "",
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "",
    city: "",
    role: "user",
    totalSpent: 0,
    ordersCount: 0,
  });

  await api
    .patch(docId)
    .set({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress || "",
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "",
    })
    .setIfMissing({
      city: "",
      role: "user",
      totalSpent: 0,
      ordersCount: 0,
    })
    .commit();

  const profile = await api.getDocument(docId);
  return normalizeUser(profile);
}

export async function saveProduct(product) {
  const api = requireClient();
  const docId = product.id || `product.${Date.now()}`;
  return api.createOrReplace(productDoc(product, docId));
}

export async function deleteProductById(productId) {
  const api = requireClient();
  return api.delete(productId);
}

export async function updateUserRole(profileId, role) {
  const api = requireClient();
  return api.patch(profileId).set({ role }).commit();
}

export async function createOrder({ clerkUser, profile, customer, items }) {
  const api = requireClient();
  const now = new Date().toISOString();
  const orderId = `order.${Date.now()}`;
  const userDocId = profile?.id || `userProfile.${clerkUser.id}`;
  const orderNumber = `DS-${Date.now().toString().slice(-8)}`;
  const orderItems = items.map((item) => ({
    _key: `${item.id}-${Math.random().toString(36).slice(2, 8)}`,
    productId: item.id,
    productName: item.name,
    club: item.club,
    image: item.image,
    price: Number(item.price),
    quantity: Number(item.quantity),
    lineTotal: Number(item.price) * Number(item.quantity),
  }));
  const total = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const transaction = api.transaction();

  transaction.createIfNotExists({
    _id: userDocId,
    _type: "userProfile",
    clerkId: clerkUser.id,
    email: customer.email,
    name: customer.name,
    city: customer.city,
    role: "user",
    totalSpent: 0,
    ordersCount: 0,
  });

  transaction.patch(userDocId, (patch) =>
    patch
      .set({
        clerkId: clerkUser.id,
        email: customer.email,
        name: customer.name,
        city: customer.city,
      })
      .setIfMissing({
        role: "user",
        totalSpent: 0,
        ordersCount: 0,
      })
      .inc({
        totalSpent: total,
        ordersCount: 1,
      }),
  );

  items.forEach((item) => {
    const nextStock = Math.max(0, Number(item.stock) - Number(item.quantity));
    transaction.patch(item.id, {
      set: {
        stock: nextStock,
        status: nextStock < 5 ? "Nizek zaloga" : "Aktiven",
      },
    });
  });

  transaction.create({
    _id: orderId,
    _type: "order",
    orderNumber,
    clerkId: clerkUser.id,
    customerName: customer.name,
    customerEmail: customer.email,
    customerCity: customer.city,
    total,
    status: "Placed",
    orderDate: now,
    items: orderItems,
  });

  await transaction.commit();

  return {
    id: orderId,
    orderNumber,
  };
}
