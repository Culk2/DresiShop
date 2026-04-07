import { useEffect, useMemo, useState } from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/react";
import {
  buildId,
  currency,
  exportOrdersPdf,
  fetchClubInsights,
  loadState,
  number,
  parseImportedFile,
  saveState,
  todayString,
} from "./utils";

const categories = ["All", "Football", "Basketball", "Custom Jerseys", "New Arrivals"];
const sizeOptions = ["All", "S", "M", "L", "XL"];
const priceOptions = ["All", "Under 80", "80-90", "90+"];

const defaultProduct = {
  id: "",
  name: "",
  club: "",
  league: "",
  price: "",
  stock: "",
  status: "Aktiven",
  featured: false,
  image: "",
};

function detectCategory(product) {
  const text = `${product.name} ${product.league} ${product.club}`.toLowerCase();
  if (text.includes("nba") || text.includes("basket")) {
    return "Basketball";
  }
  return "Football";
}

export default function App() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState(() => loadState());
  const [productForm, setProductForm] = useState(defaultProduct);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [category, setCategory] = useState("All");
  const [sizeFilter, setSizeFilter] = useState("All");
  const [teamFilter, setTeamFilter] = useState("All");
  const [priceFilter, setPriceFilter] = useState("All");
  const [cartPulse, setCartPulse] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [emailDraft, setEmailDraft] = useState({
    recipients: [],
    subject: "Novo obvestilo iz Dresi Shop",
    message: "Pozdravljeni, obvescamo vas o novostih v nasi ponudbi dresov.",
  });
  const [checkoutCustomer, setCheckoutCustomer] = useState({
    name: "",
    email: "",
    city: "",
  });
  const [apiState, setApiState] = useState({
    loading: false,
    data: null,
    error: "",
  });

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    setCheckoutCustomer((current) => ({
      ...current,
      name: current.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "",
      email: current.email || user.primaryEmailAddress?.emailAddress || "",
    }));
  }, [isLoaded, isSignedIn, user]);

  useEffect(() => {
    if (!selectedProductId && state.products[0]) {
      setSelectedProductId(state.products[0].id);
    }
  }, [selectedProductId, state.products]);

  useEffect(() => {
    if (!cartPulse) {
      return;
    }
    const timeout = setTimeout(() => setCartPulse(false), 500);
    return () => clearTimeout(timeout);
  }, [cartPulse]);

  useEffect(() => {
    const selectedProduct = state.products.find((product) => product.id === selectedProductId);
    if (!selectedProduct?.club) {
      return;
    }

    let cancelled = false;

    async function loadClubInfo() {
      setApiState({ loading: true, data: null, error: "" });
      try {
        const data = await fetchClubInsights(selectedProduct.club);
        if (!cancelled) {
          setApiState({ loading: false, data, error: "" });
        }
      } catch (error) {
        if (!cancelled) {
          setApiState({
            loading: false,
            data: null,
            error: error.message || "API ni dosegljiv.",
          });
        }
      }
    }

    loadClubInfo();
    return () => {
      cancelled = true;
    };
  }, [selectedProductId, state.products]);

  const lowStockProducts = useMemo(
    () => state.products.filter((product) => Number(product.stock) < 6),
    [state.products],
  );

  const availableTeams = useMemo(
    () => ["All", ...new Set(state.products.map((product) => product.club))],
    [state.products],
  );

  const storefrontProducts = useMemo(() => {
    return state.products.filter((product) => {
      const query = productFilter.toLowerCase();
      const productCategory = detectCategory(product);
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.club.toLowerCase().includes(query) ||
        product.league.toLowerCase().includes(query);
      const matchesCategory =
        category === "All" ||
        category === "New Arrivals" ||
        category === productCategory ||
        (category === "Custom Jerseys" && product.featured);
      const matchesTeam = teamFilter === "All" || product.club === teamFilter;
      const matchesSize = sizeFilter === "All" || ["S", "M", "L", "XL"].includes(sizeFilter);
      const matchesPrice =
        priceFilter === "All" ||
        (priceFilter === "Under 80" && Number(product.price) < 80) ||
        (priceFilter === "80-90" && Number(product.price) >= 80 && Number(product.price) <= 90) ||
        (priceFilter === "90+" && Number(product.price) > 90);

      return matchesSearch && matchesCategory && matchesTeam && matchesSize && matchesPrice;
    });
  }, [state.products, productFilter, category, teamFilter, sizeFilter, priceFilter]);

  const filteredProducts = useMemo(() => {
    return [...state.products]
      .filter((product) => {
        const query = productFilter.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          product.club.toLowerCase().includes(query) ||
          product.league.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        if (sortBy === "price") {
          return Number(b.price) - Number(a.price);
        }
        if (sortBy === "stock") {
          return Number(a.stock) - Number(b.stock);
        }
        return a.name.localeCompare(b.name);
      });
  }, [productFilter, sortBy, state.products]);

  const salesByClub = useMemo(() => {
    const totals = state.orders.reduce((acc, order) => {
      const product = state.products.find((item) => item.id === order.productId);
      const key = product?.club || "Ostalo";
      acc[key] = (acc[key] || 0) + Number(order.total);
      return acc;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [state.orders, state.products]);

  const heroProduct = state.products.find((product) => product.featured) || state.products[0];
  const trendingProducts = state.products.slice(0, 3);
  const footballProducts = state.products.filter((product) => detectCategory(product) === "Football");
  const basketballProducts = state.products.filter((product) => detectCategory(product) === "Basketball");

  function resetForm() {
    setProductForm(defaultProduct);
  }

  function handleProductSubmit(event) {
    event.preventDefault();
    const payload = {
      ...productForm,
      id: productForm.id || buildId("P"),
      price: Number(productForm.price),
      stock: Number(productForm.stock),
    };

    setState((current) => {
      const exists = current.products.some((product) => product.id === payload.id);
      const products = exists
        ? current.products.map((product) => (product.id === payload.id ? payload : product))
        : [...current.products, payload];
      return { ...current, products };
    });

    setSelectedProductId(payload.id);
    resetForm();
  }

  function editProduct(product) {
    setProductForm({
      ...product,
      price: String(product.price),
      stock: String(product.stock),
    });
  }

  function deleteProduct(id) {
    setState((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== id),
    }));
    if (selectedProductId === id) {
      setSelectedProductId("");
    }
  }

  function quickAddToCart() {
    setCartCount((current) => current + 1);
    setCartPulse(true);
  }

  function handleAddToCart(product) {
    quickAddToCart();
    setSelectedProductId(product.id);
  }

  function handleCheckout(product) {
    if (!isSignedIn) {
      alert("Za oddajo narocila se najprej prijavi.");
      return;
    }

    if (!checkoutCustomer.name || !checkoutCustomer.email) {
      alert("Vnesi ime in email kupca.");
      return;
    }

    handleAddToCart(product);

    const customerId = buildId("C");
    const orderId = buildId("O");

    setState((current) => {
      const existingCustomer = current.customers.find(
        (customer) => customer.email.toLowerCase() === checkoutCustomer.email.toLowerCase(),
      );
      const customer = existingCustomer || {
        id: customerId,
        name: checkoutCustomer.name,
        email: checkoutCustomer.email,
        city: checkoutCustomer.city,
        segment: "Novi",
        totalSpent: 0,
      };

      const updatedCustomers = existingCustomer
        ? current.customers.map((item) =>
            item.id === existingCustomer.id
              ? { ...item, totalSpent: Number(item.totalSpent) + Number(product.price) }
              : item,
          )
        : [...current.customers, { ...customer, totalSpent: Number(product.price) }];

      const newOrder = {
        id: orderId,
        customerId: customer.id,
        customerName: customer.name,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        total: Number(product.price),
        status: "Novo narocilo",
        createdAt: todayString(),
      };

      const newEmail = {
        id: buildId("M"),
        to: customer.email,
        subject: "Potrditev narocila",
        type: "Avtomatski",
        sentAt: new Date().toLocaleString("sl-SI"),
        status: "Poslano",
      };

      return {
        ...current,
        customers: updatedCustomers,
        orders: [newOrder, ...current.orders],
        emails: [newEmail, ...current.emails],
        products: current.products.map((item) =>
          item.id === product.id ? { ...item, stock: Math.max(0, Number(item.stock) - 1) } : item,
        ),
      };
    });
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rows = await parseImportedFile(file);
      const importedProducts = rows
        .filter((row) => row.name || row.Name)
        .map((row) => ({
          id: buildId("P"),
          name: row.name || row.Name,
          club: row.club || row.Club || "Neznan klub",
          league: row.league || row.League || "Liga ni dolocena",
          price: Number(row.price || row.Price || 0),
          stock: Number(row.stock || row.Stock || 0),
          status: row.status || row.Status || "Aktiven",
          featured: String(row.featured || row.Featured || "").toLowerCase() === "true",
          image:
            row.image ||
            row.Image ||
            "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80",
        }));

      setState((current) => ({
        ...current,
        products: [...current.products, ...importedProducts],
        imports: [
          {
            id: buildId("I"),
            fileName: file.name,
            rows: importedProducts.length,
            createdAt: new Date().toLocaleString("sl-SI"),
          },
          ...current.imports,
        ],
      }));
    } catch {
      alert("Uvoz ni uspel. Preveri strukturo CSV/XLSX datoteke.");
    } finally {
      event.target.value = "";
    }
  }

  function toggleRecipient(email) {
    setEmailDraft((current) => ({
      ...current,
      recipients: current.recipients.includes(email)
        ? current.recipients.filter((item) => item !== email)
        : [...current.recipients, email],
    }));
  }

  function sendCampaign() {
    if (!emailDraft.recipients.length) {
      alert("Izberi vsaj enega prejemnika.");
      return;
    }

    const draftBody = encodeURIComponent(emailDraft.message);
    const draftSubject = encodeURIComponent(emailDraft.subject);
    const recipientList = emailDraft.recipients.join(",");
    window.open(`mailto:${recipientList}?subject=${draftSubject}&body=${draftBody}`);

    setState((current) => ({
      ...current,
      emails: [
        {
          id: buildId("M"),
          to: recipientList,
          subject: emailDraft.subject,
          type: "Rocni",
          sentAt: new Date().toLocaleString("sl-SI"),
          status: "Odprto v email odjemalcu",
        },
        ...current.emails,
      ],
    }));
  }

  return (
    <div className="store-shell">
      <header className="store-header">
        <div className="brand-lockup">
          <span className="brand-mark">DRESI</span>
          <strong>SHOP</strong>
        </div>

        <div className="header-tools">
          <label className="search-shell">
            <span>Search</span>
            <input
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              placeholder="Search teams, jerseys, leagues"
            />
          </label>
          <button className={cartPulse ? "cart-button pulse" : "cart-button"} onClick={quickAddToCart}>
            Cart
            <span>{number(cartCount)}</span>
          </button>
          <div className="auth-cluster">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal">
                  <button className="secondary-cta" type="button">
                    Prijava
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="primary-cta" type="button">
                    Registracija
                  </button>
                </SignUpButton>
              </>
            ) : null}
            {isSignedIn ? (
              <div className="user-shell">
                <div>
                  <span className="user-shell-label">Prijavljen uporabnik</span>
                  <strong>{user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress}</strong>
                </div>
                <UserButton />
              </div>
            ) : null}
          </div>
        </div>
      </header>

        <main className="store-main">
          <>
            <section className="featured-strip">
              <div className="featured-copy">
                <span className="section-tag">Trending Now</span>
                <h2>Limited-edition jerseys and fan favorites</h2>
              </div>
              <div className="featured-list">
                {trendingProducts.map((product) => (
                  <button
                    key={product.id}
                    className="featured-pill"
                    onClick={() => {
                      setSelectedProductId(product.id);
                      setCategory(detectCategory(product));
                    }}
                  >
                    <span>{product.club}</span>
                    <strong>{product.name}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="category-showcase">
              <article className="showcase-card football-card">
                <span className="section-tag">Football</span>
                <h3>Matchday classics and new season kits</h3>
                <p>{number(footballProducts.length)} products ready for fans and collectors.</p>
                <button className="secondary-cta" onClick={() => setCategory("Football")}>
                  Explore Football
                </button>
              </article>

              <article className="showcase-card basketball-card">
                <span className="section-tag">Basketball</span>
                <h3>Street-ready silhouettes with arena energy</h3>
                <p>{number(basketballProducts.length)} basketball-inspired jerseys in the catalog.</p>
                <button className="secondary-cta" onClick={() => setCategory("Basketball")}>
                  Explore Basketball
                </button>
              </article>

              <article className="showcase-card custom-card">
                <span className="section-tag">Custom Jerseys</span>
                <h3>Premium custom drops built for standout supporters</h3>
                <p>Use featured products as the base for personalized fan campaigns.</p>
                <button className="secondary-cta" onClick={() => setCategory("Custom Jerseys")}>
                  Explore Customs
                </button>
              </article>
            </section>

            <section className="store-content">
              <aside className="filters-panel">
                <div className="filter-card">
                  <span className="section-tag">Filters</span>
                  <h3>Refine the drop</h3>
                </div>

                <label className="filter-group">
                  <span>Category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="filter-group">
                  <span>Size</span>
                  <select value={sizeFilter} onChange={(event) => setSizeFilter(event.target.value)}>
                    {sizeOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="filter-group">
                  <span>Team</span>
                  <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
                    {availableTeams.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="filter-group">
                  <span>Price</span>
                  <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
                    {priceOptions.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <div className="filter-card accent-card">
                  <span>Low stock</span>
                  <strong>{number(lowStockProducts.length)}</strong>
                  <p>Move these products into campaigns or restock planning.</p>
                </div>
              </aside>

              <section className="catalog-panel">
                <div className="catalog-head">
                  <div>
                    <span className="section-tag">Catalog</span>
                    <h2>Shop jerseys</h2>
                  </div>
                  <span className="catalog-count">{number(storefrontProducts.length)} products</span>
                </div>

                <div className="product-grid">
                  {storefrontProducts.map((product) => (
                    <article className="catalog-card" key={product.id}>
                      <div className="catalog-image">
                        <img src={product.image} alt={product.name} />
                        <div className="card-hover">
                          <button className="quick-add-button" onClick={() => handleAddToCart(product)}>
                            Quick Add
                          </button>
                        </div>
                      </div>
                      <div className="catalog-body">
                        <div className="catalog-meta">
                          <span>{detectCategory(product)}</span>
                          {product.featured ? <span className="meta-accent">Featured</span> : null}
                        </div>
                        <h3>{product.name}</h3>
                        <p>{product.club}</p>
                        <div className="catalog-footer">
                          <strong>{currency(product.price)}</strong>
                          <button className="buy-button" onClick={() => handleAddToCart(product)}>
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </section>

            <section className="home-banner">
              <div className="banner-copy">
                <span className="section-tag">Featured Experience</span>
                <h2>Build a storefront that feels like a launch campaign</h2>
                <p>
                  The homepage now combines landing-page storytelling, premium product browsing,
                  category discovery, and real storefront actions in one flow.
                </p>
              </div>
              <div className="banner-points">
                <div className="banner-point">
                  <strong>Fast hover actions</strong>
                  <span>Quick add and animated cart feedback.</span>
                </div>
                <div className="banner-point">
                  <strong>Smart filtering</strong>
                  <span>Search by team, category, size, and price.</span>
                </div>
                <div className="banner-point">
                  <strong>Premium look</strong>
                  <span>Dark gradients, glass depth, and sports-driven styling.</span>
                </div>
              </div>
            </section>

            <section className="checkout-section">
              <div className="checkout-copy">
                <span className="section-tag">Checkout Simulator</span>
                <h2>Complete a test order from the storefront</h2>
                <p>
                  Prijava prek Clerk se tukaj uporabi za identifikacijo kupca. Prijavljen uporabnik
                  lahko odda testno narocilo brez ponovnega vnosa emaila.
                </p>
              </div>

              <div className="checkout-card">
                {!isSignedIn ? (
                  <div className="auth-callout">
                    <strong>Za checkout potrebujes prijavo.</strong>
                    <p>Ustvari racun ali se prijavi, da se narocilo shrani med stranke in narocila.</p>
                    <div className="auth-callout-actions">
                      <SignInButton mode="modal">
                        <button className="secondary-cta" type="button">
                          Prijava
                        </button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <button className="primary-cta" type="button">
                          Registracija
                        </button>
                      </SignUpButton>
                    </div>
                  </div>
                ) : null}
                <div className="checkout-fields">
                  <input
                    placeholder="Ime kupca"
                    value={checkoutCustomer.name}
                    onChange={(event) =>
                      setCheckoutCustomer((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                  <input
                    placeholder="Email kupca"
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
                </div>
                {heroProduct ? (
                  <div className="checkout-highlight">
                    <div>
                      <span>Selected jersey</span>
                      <strong>{heroProduct.name}</strong>
                    </div>
                    <button
                      className="primary-cta"
                      onClick={() => handleCheckout(heroProduct)}
                      disabled={!isSignedIn}
                      type="button"
                    >
                      Simulate order
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="spotlight-section">
              <div className="spotlight-copy">
                <span className="section-tag">Club Insight</span>
                <h2>Sports data layered into the shopping experience</h2>
                <p>
                  Use external API data to enrich product pages with club identity, stadium details, and
                  context that feels valuable to fans.
                </p>
              </div>

              <div className="spotlight-card">
                <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  {state.products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.club}
                    </option>
                  ))}
                </select>
                {apiState.loading ? <p>Loading club data...</p> : null}
                {apiState.error ? <p className="warning">{apiState.error}</p> : null}
                {apiState.data ? (
                  <div className="club-insight">
                    {apiState.data.badge ? <img src={apiState.data.badge} alt={apiState.data.team} /> : null}
                    <strong>{apiState.data.team}</strong>
                    <span>{apiState.data.league}</span>
                    <span>{apiState.data.stadium}</span>
                    <span>{apiState.data.country}</span>
                  </div>
                ) : null}
              </div>
            </section>
        </>
      </main>

      <footer className="store-footer">
        <div>
          <strong>Dresi Shop</strong>
          <span>Premium sports jersey storefront</span>
        </div>
        <div>
          <span>Football</span>
          <span>Basketball</span>
          <span>Custom Jerseys</span>
          <span>New Arrivals</span>
        </div>
      </footer>
    </div>
  );
}
