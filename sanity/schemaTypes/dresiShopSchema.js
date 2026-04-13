export const product = {
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    { name: "name", title: "Name", type: "string", validation: (Rule) => Rule.required() },
    { name: "club", title: "Club", type: "string", validation: (Rule) => Rule.required() },
    { name: "league", title: "League", type: "string" },
    {
      name: "category",
      title: "Category",
      type: "string",
      options: { list: ["Football", "Basketball", "Lifestyle"] },
    },
    { name: "price", title: "Price", type: "number", validation: (Rule) => Rule.required().min(0) },
    { name: "stock", title: "Stock", type: "number", validation: (Rule) => Rule.required().min(0) },
    { name: "status", title: "Status", type: "string" },
    { name: "featured", title: "Featured", type: "boolean" },
    { name: "image", title: "Image URL", type: "url" },
    { name: "description", title: "Description", type: "text" },
  ],
};

export const userProfile = {
  name: "userProfile",
  title: "User Profile",
  type: "document",
  fields: [
    { name: "clerkId", title: "Clerk ID", type: "string", validation: (Rule) => Rule.required() },
    { name: "name", title: "Name", type: "string" },
    { name: "email", title: "Email", type: "string" },
    { name: "city", title: "City", type: "string" },
    {
      name: "role",
      title: "Role",
      type: "string",
      initialValue: "user",
      options: { list: ["user", "admin"] },
    },
    { name: "totalSpent", title: "Total spent", type: "number", initialValue: 0 },
    { name: "ordersCount", title: "Orders count", type: "number", initialValue: 0 },
  ],
};

export const order = {
  name: "order",
  title: "Order",
  type: "document",
  fields: [
    { name: "orderNumber", title: "Order number", type: "string", validation: (Rule) => Rule.required() },
    { name: "clerkId", title: "Clerk ID", type: "string" },
    { name: "customerName", title: "Customer name", type: "string" },
    { name: "customerEmail", title: "Customer email", type: "string" },
    { name: "customerCity", title: "Customer city", type: "string" },
    { name: "total", title: "Total", type: "number" },
    {
      name: "status",
      title: "Status",
      type: "string",
      initialValue: "Placed",
      options: { list: ["Placed", "Processing", "Shipped"] },
    },
    { name: "orderDate", title: "Order date", type: "datetime" },
    {
      name: "items",
      title: "Items",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "productId", title: "Product ID", type: "string" },
            { name: "productName", title: "Product name", type: "string" },
            { name: "club", title: "Club", type: "string" },
            { name: "image", title: "Image URL", type: "url" },
            { name: "price", title: "Price", type: "number" },
            { name: "quantity", title: "Quantity", type: "number" },
            { name: "lineTotal", title: "Line total", type: "number" },
          ],
        },
      ],
    },
  ],
};

export const schemaTypes = [product, userProfile, order];
