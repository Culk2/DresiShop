import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/react";
import { currency, exportOrdersPdf, number } from "./utils";
import {
  createOrder,
  deleteProductById,
  ensureUserProfile,
  fetchShopData,
  hasSanityConfig,
  saveProduct,
  updateUserRole,
} from "./sanity";

const categories = ["All", "Football", "Basketball", "Lifestyle"];

const emptyProductForm = {
  id: "",
  name: "",
  club: "",
  league: "",
  category: "Football",
  price: "89.9",
  stock: "10",
  image: "",
  description: "",
  featured: false,
  status: "Aktiven",
};

function defaultCheckoutCustomer(user) {
  return {
    name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "",
    email: user?.primaryEmailAddress?.emailAddress || "",
    city: "",
  };
}

export default function App() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [store, setStore] = useState({ products: [], users: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState([]);
  const [activeView, setActiveView] = useState("shop");
  const [checkoutCustomer, setCheckoutCustomer] = useState(defaultCheckoutCustomer(null));
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [orderFilter, setOrderFilter] = useState("All");

  async function refreshStore() {
    if (!hasSanityConfig) {
      setLoading(false);
      setError("Manjkajo Sanity nastavitve v .env datoteki.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await fetchShopData();
      setStore(data);
    } catch (fetchError) {
      setError(fetchError.message || "Napaka pri nalaganju podatkov iz Sanity.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshStore();
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !hasSanityConfig) {
      return;
    }

    let cancelled = false;

    async function syncProfile() {
      try {
        await ensureUserProfile(user);
        if (!cancelled) {
          setCheckoutCustomer((current) => ({
            ...defaultCheckoutCustomer(user),
            city: current.city,
          }));
          await refreshStore();
        }
      } catch (syncError) {
        if (!cancelled) {
          setError(syncError.message || "Uporabnika ni bilo mogoce sinhronizirati v Sanity.");
        }
      }
    }

    syncProfile();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user]);

  const currentProfile = useMemo(() => {
    if (!user) {
      return null;
    }

    return store.users.find((item) => item.clerkId === user.id) || null;
  }, [store.users, user]);

  const isAdmin = currentProfile?.role === "admin";

  useEffect(() => {
    if (!isAdmin && activeView === "admin") {
      setActiveView("shop");
    }
  }, [activeView, isAdmin]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return store.products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.club.toLowerCase().includes(query) ||
        product.league.toLowerCase().includes(query);

      return matchesCategory && matchesQuery;
    });
  }, [category, search, store.products]);

  const cartItems = useMemo(() => {
    return cart
      .map((entry) => {
        const product = store.products.find((item) => item.id === entry.productId);
        if (!product) {
          return null;
        }

        return {
          ...entry,
          product,
          lineTotal: entry.quantity * Number(product.price),
        };
      })
      .filter(Boolean);
  }, [cart, store.products]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [cartItems],
  );

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const myOrders = useMemo(() => {
    if (!user) {
      return [];
    }

    return store.orders.filter((order) => order.clerkId === user.id);
  }, [store.orders, user]);

  const visibleOrders = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    return store.orders.filter((order) => orderFilter === "All" || order.status === orderFilter);
  }, [isAdmin, orderFilter, store.orders]);

  const adminMetrics = useMemo(() => {
    const revenue = store.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const lowStock = store.products.filter((product) => Number(product.stock) < 5).length;

    return {
      revenue,
      lowStock,
      orderCount: store.orders.length,
      userCount: store.users.length,
    };
  }, [store.orders, store.products, store.users.length]);

  function setFormValue(field, value) {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetProductForm() {
    setProductForm(emptyProductForm);
  }

  function handleAddToCart(product) {
    if (Number(product.stock) < 1) {
      setNotice("Izdelek trenutno ni na zalogi.");
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);

      if (existing) {
        const nextQuantity = Math.min(existing.quantity + 1, Number(product.stock));
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: nextQuantity } : item,
        );
      }

      return [...current, { productId: product.id, quantity: 1 }];
    });

    setNotice(`${product.name} je dodan v kosarico.`);
  }

  function changeCartQuantity(productId, quantity) {
    const product = store.products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const safeQuantity = Math.max(1, Math.min(quantity, Number(product.stock)));
    setCart((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity: safeQuantity } : item)),
    );
  }

  function removeFromCart(productId) {
    setCart((current) => current.filter((item) => item.productId !== productId));
  }

  async function handleCheckout(event) {
    event.preventDefault();

    if (!isSignedIn || !user) {
      setError("Za nakup se moras prijaviti.");
      return;
    }

    if (!cartItems.length) {
      setError("Kosarica je prazna.");
      return;
    }

    if (!checkoutCustomer.name || !checkoutCustomer.email || !checkoutCustomer.city) {
      setError("Izpolni ime, email in mesto za zakljucek nakupa.");
      return;
    }

    const oversoldItem = cartItems.find((item) => item.quantity > Number(item.product.stock));
    if (oversoldItem) {
      setError(`Za ${oversoldItem.product.name} ni dovolj zaloge.`);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await createOrder({
        clerkUser: user,
        profile: currentProfile,
        customer: checkoutCustomer,
        items: cartItems.map((item) => ({
          id: item.product.id,
          name: item.product.name,
          club: item.product.club,
          image: item.product.image,
          price: Number(item.product.price),
          stock: Number(item.product.stock),
          quantity: item.quantity,
        })),
      });

      setCart([]);
      setNotice("Narocilo je bilo uspesno oddano v Sanity.");
      await refreshStore();
    } catch (checkoutError) {
      setError(checkoutError.message || "Nakupa ni bilo mogoce zakljuciti.");
    } finally {
      setBusy(false);
    }
  }

  async function handleProductSubmit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await saveProduct({
        id: productForm.id,
        name: productForm.name,
        club: productForm.club,
        league: productForm.league,
        category: productForm.category,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        image: productForm.image,
        description: productForm.description,
        featured: productForm.featured,
        status: productForm.status,
      });

      resetProductForm();
      setNotice("Izdelek je shranjen v Sanity.");
      await refreshStore();
    } catch (productError) {
      setError(productError.message || "Izdelka ni bilo mogoce shraniti.");
    } finally {
      setBusy(false);
    }
  }

  function startEditingProduct(product) {
    setProductForm({
      id: product.id,
      name: product.name,
      club: product.club,
      league: product.league,
      category: product.category,
      price: String(product.price),
      stock: String(product.stock),
      image: product.image,
      description: product.description || "",
      featured: Boolean(product.featured),
      status: product.status,
    });
    setActiveView("admin");
  }

  async function handleDeleteProduct(productId) {
    setBusy(true);
    setError("");

    try {
      await deleteProductById(productId);
      setNotice("Izdelek je izbrisan.");
      await refreshStore();
    } catch (deleteError) {
      setError(deleteError.message || "Izdelka ni bilo mogoce izbrisati.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(profileId, role) {
    setBusy(true);
    setError("");

    try {
      await updateUserRole(profileId, role);
      setNotice(`Vloga je posodobljena na ${role}.`);
      await refreshStore();
    } catch (roleError) {
      setError(roleError.message || "Vloge ni bilo mogoce spremeniti.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasSanityConfig) {
    return (
      <div className="config-screen">
        <div className="config-card">
          <span className="eyebrow">Sanity Setup</span>
          <h1>Dodaj Sanity podatke v `.env`.</h1>
          <p>
            Potrebujes `VITE_SANITY_PROJECT_ID`, `VITE_SANITY_DATASET` in
            `VITE_SANITY_API_TOKEN`, sicer trgovina ne more brati ali pisati podatkov.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Dresi Shop</span>
          <h1>Sanity powered sports shop</h1>
        </div>

        <div className="topbar-actions">
          <button
            className={activeView === "shop" ? "ghost-button active" : "ghost-button"}
            onClick={() => setActiveView("shop")}
            type="button"
          >
            Shop
          </button>
          {isAdmin ? (
            <button
              className={activeView === "admin" ? "ghost-button active" : "ghost-button"}
              onClick={() => setActiveView("admin")}
              type="button"
            >
              Admin panel
            </button>
          ) : null}
          <div className="cart-pill">
            <span>Kosarica</span>
            <strong>{number(cartCount)}</strong>
          </div>
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal">
                <button className="ghost-button" type="button">
                  Prijava
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="primary-button" type="button">
                  Registracija
                </button>
              </SignUpButton>
            </>
          ) : (
            <div className="user-badge">
              <div>
                <span>Prijavljen</span>
                <strong>{currentProfile?.role === "admin" ? "Admin" : "Uporabnik"}</strong>
              </div>
              <UserButton />
            </div>
          )}
        </div>
      </header>

      {notice ? <div className="message success">{notice}</div> : null}
      {error ? <div className="message error">{error}</div> : null}
      {loading ? <div className="message">Nalagam podatke iz Sanity ...</div> : null}

      {activeView === "shop" ? (
        <main className="layout">
          <section className="hero-card">
            <div className="hero-copy">
              <span className="eyebrow">Storefront</span>
              <h2>Dresi, kosarica, checkout in narocila v eni aplikaciji</h2>
              <p>
                Registriran uporabnik dobi v Sanity `userProfile` dokument z vlogo `user`. Admin lahko
                kasneje v aplikaciji ali v Sanity spremeni vlogo na `admin`.
              </p>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <span>Izdelki</span>
                <strong>{number(store.products.length)}</strong>
              </div>
              <div className="stat-card">
                <span>Narocila</span>
                <strong>{number(store.orders.length)}</strong>
              </div>
              <div className="stat-card">
                <span>Uporabniki</span>
                <strong>{number(store.users.length)}</strong>
              </div>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Filtri</span>
                  <h3>Najdi pravi dres</h3>
                </div>
              </div>
              <div className="filters">
                <input
                  placeholder="Isci po klubu, ligi ali imenu"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <img src={product.image} alt={product.name} />
                    <div className="product-body">
                      <div className="product-tags">
                        <span>{product.category}</span>
                        {product.featured ? <span className="accent-tag">Featured</span> : null}
                      </div>
                      <h3>{product.name}</h3>
                      <p>{product.club} - {product.league}</p>
                      <p className="muted">{product.description || "Premium fan dres za tekmo ali zbirko."}</p>
                      <div className="product-foot">
                        <div>
                          <strong>{currency(product.price)}</strong>
                          <span className="stock-text">Zaloga: {number(product.stock)}</span>
                        </div>
                        <button
                          className="primary-button"
                          onClick={() => handleAddToCart(product)}
                          type="button"
                        >
                          Dodaj v kosarico
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="sidebar">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Kosarica</span>
                    <h3>{number(cartCount)} izdelkov</h3>
                  </div>
                  <strong>{currency(cartTotal)}</strong>
                </div>

                <div className="cart-list">
                  {cartItems.length ? (
                    cartItems.map((item) => (
                      <div className="cart-row" key={item.product.id}>
                        <img src={item.product.image} alt={item.product.name} />
                        <div>
                          <strong>{item.product.name}</strong>
                          <span>{currency(item.product.price)}</span>
                        </div>
                        <input
                          min="1"
                          max={item.product.stock}
                          type="number"
                          value={item.quantity}
                          onChange={(event) =>
                            changeCartQuantity(item.product.id, Number(event.target.value || 1))
                          }
                        />
                        <button
                          className="ghost-button danger-button"
                          onClick={() => removeFromCart(item.product.id)}
                          type="button"
                        >
                          Odstrani
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Kosarica je prazna.</p>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Checkout</span>
                    <h3>Oddaj narocilo</h3>
                  </div>
                </div>

                {!isSignedIn ? (
                  <div className="auth-box">
                    <p>Za nakup se prijavi. Ob prvi prijavi se v Sanity samodejno ustvari uporabnik z vlogo `user`.</p>
                  </div>
                ) : null}

                <form className="checkout-form" onSubmit={handleCheckout}>
                  <input
                    placeholder="Ime"
                    value={checkoutCustomer.name}
                    onChange={(event) =>
                      setCheckoutCustomer((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Email"
                    value={checkoutCustomer.email}
                    onChange={(event) =>
                      setCheckoutCustomer((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Mesto"
                    value={checkoutCustomer.city}
                    onChange={(event) =>
                      setCheckoutCustomer((current) => ({ ...current, city: event.target.value }))
                    }
                  />
                  <button className="primary-button" disabled={busy || !isSignedIn} type="submit">
                    {busy ? "Shranjujem ..." : "Zakljuci nakup"}
                  </button>
                </form>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <span className="eyebrow">Moja narocila</span>
                    <h3>{number(myOrders.length)} zapisov</h3>
                  </div>
                </div>
                <div className="order-list">
                  {myOrders.length ? (
                    myOrders.map((order) => (
                      <article className="order-card" key={order.id}>
                        <div className="order-head">
                          <strong>{order.orderNumber}</strong>
                          <span>{order.status}</span>
                        </div>
                        <p>{new Date(order.orderDate).toLocaleString("sl-SI")}</p>
                        <p>{currency(order.total)}</p>
                        <ul>
                          {order.items.map((item) => (
                            <li key={`${order.id}-${item.productId}`}>
                              {item.productName} x {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))
                  ) : (
                    <p className="muted">Ko bos oddal prvo narocilo, se bo prikazalo tukaj.</p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </main>
      ) : null}

      {activeView === "admin" && isAdmin ? (
        <main className="admin-layout">
          <section className="hero-card admin-summary">
            <div className="hero-copy">
              <span className="eyebrow">Admin</span>
              <h2>Upravljanje uporabnikov, izdelkov in narocil</h2>
              <p>
                Admin vidi vse podrobnosti narocil, lahko dodeli admin vlogo drugim uporabnikom in
                upravlja katalog izdelkov.
              </p>
            </div>
            <div className="hero-stats">
              <div className="stat-card">
                <span>Promet</span>
                <strong>{currency(adminMetrics.revenue)}</strong>
              </div>
              <div className="stat-card">
                <span>Nizka zaloga</span>
                <strong>{number(adminMetrics.lowStock)}</strong>
              </div>
              <div className="stat-card">
                <span>Narocila</span>
                <strong>{number(adminMetrics.orderCount)}</strong>
              </div>
            </div>
          </section>

          <section className="admin-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Users</span>
                  <h3>Vloge uporabnikov</h3>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Ime</th>
                      <th>Email</th>
                      <th>Vloga</th>
                      <th>Poraba</th>
                      <th>Akcija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {store.users.map((profile) => (
                      <tr key={profile.id}>
                        <td>{profile.name || "Brez imena"}</td>
                        <td>{profile.email}</td>
                        <td>{profile.role}</td>
                        <td>{currency(profile.totalSpent || 0)}</td>
                        <td className="button-cell">
                          <button
                            className="ghost-button"
                            onClick={() => handleRoleChange(profile.id, "user")}
                            type="button"
                          >
                            User
                          </button>
                          <button
                            className="ghost-button"
                            onClick={() => handleRoleChange(profile.id, "admin")}
                            type="button"
                          >
                            Admin
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <span className="eyebrow">Products</span>
                  <h3>{productForm.id ? "Uredi izdelek" : "Dodaj izdelek"}</h3>
                </div>
              </div>
              <form className="product-form" onSubmit={handleProductSubmit}>
                <input
                  placeholder="Naziv izdelka"
                  value={productForm.name}
                  onChange={(event) => setFormValue("name", event.target.value)}
                />
                <input
                  placeholder="Klub"
                  value={productForm.club}
                  onChange={(event) => setFormValue("club", event.target.value)}
                />
                <input
                  placeholder="Liga"
                  value={productForm.league}
                  onChange={(event) => setFormValue("league", event.target.value)}
                />
                <select
                  value={productForm.category}
                  onChange={(event) => setFormValue("category", event.target.value)}
                >
                  {categories.slice(1).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <input
                  placeholder="Cena"
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.price}
                  onChange={(event) => setFormValue("price", event.target.value)}
                />
                <input
                  placeholder="Zaloga"
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) => setFormValue("stock", event.target.value)}
                />
                <input
                  placeholder="URL slike"
                  value={productForm.image}
                  onChange={(event) => setFormValue("image", event.target.value)}
                />
                <select value={productForm.status} onChange={(event) => setFormValue("status", event.target.value)}>
                  <option>Aktiven</option>
                  <option>Arhiviran</option>
                  <option>Nizek zaloga</option>
                </select>
                <label className="checkbox-row">
                  <input
                    checked={productForm.featured}
                    onChange={(event) => setFormValue("featured", event.target.checked)}
                    type="checkbox"
                  />
                  <span>Featured izdelek</span>
                </label>
                <textarea
                  placeholder="Opis"
                  rows="4"
                  value={productForm.description}
                  onChange={(event) => setFormValue("description", event.target.value)}
                />
                <div className="button-row">
                  <button className="primary-button" disabled={busy} type="submit">
                    {busy ? "Shranjujem ..." : productForm.id ? "Posodobi" : "Dodaj"}
                  </button>
                  <button className="ghost-button" onClick={resetProductForm} type="button">
                    Pocisti
                  </button>
                </div>
              </form>
            </article>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Orders</span>
                <h3>Vsa narocila</h3>
              </div>
              <div className="button-row">
                <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}>
                  <option>All</option>
                  <option>Placed</option>
                  <option>Processing</option>
                  <option>Shipped</option>
                </select>
                <button className="ghost-button" onClick={() => exportOrdersPdf(visibleOrders)} type="button">
                  Export PDF
                </button>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Stevilka</th>
                    <th>Kupec</th>
                    <th>Mesto</th>
                    <th>Izdelki</th>
                    <th>Znesek</th>
                    <th>Status</th>
                    <th>Datum</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderNumber}</td>
                      <td>
                        {order.customerName}
                        <br />
                        <span className="muted">{order.customerEmail}</span>
                      </td>
                      <td>{order.customerCity}</td>
                      <td>
                        {order.items.map((item) => (
                          <div key={`${order.id}-${item.productId}`}>
                            {item.productName} x {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td>{currency(order.total)}</td>
                      <td>{order.status}</td>
                      <td>{new Date(order.orderDate).toLocaleString("sl-SI")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">Catalog</span>
                <h3>Hitri pregled izdelkov</h3>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Izdelek</th>
                    <th>Kategorija</th>
                    <th>Cena</th>
                    <th>Zaloga</th>
                    <th>Status</th>
                    <th>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {store.products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.category}</td>
                      <td>{currency(product.price)}</td>
                      <td>{number(product.stock)}</td>
                      <td>{product.status}</td>
                      <td className="button-cell">
                        <button className="ghost-button" onClick={() => startEditingProduct(product)} type="button">
                          Uredi
                        </button>
                        <button
                          className="ghost-button danger-button"
                          onClick={() => handleDeleteProduct(product.id)}
                          type="button"
                        >
                          Izbrisi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      ) : null}
    </div>
  );
}
