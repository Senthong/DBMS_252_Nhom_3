import { useEffect, useState } from "react";
import API from "./api";

export default function App() {
  // ================= TAB =================
  const [tab, setTab] = useState("home");

  // ================= PRODUCT =================
  const [products, setProducts] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ================= ADMIN =================
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("created");
  const [orders, setOrders] = useState([]);

  // ================= ANALYSIS =================
  const [plan, setPlan] = useState("");

  // ================= LOAD PRODUCTS =================
  const loadProducts = async () => {
    const res = await API.get(`/products?page=${page}&limit=8`);
    setProducts(res.data);
  };

  const loadRanking = async () => {
    const res = await API.get("/products/ranking");
    setRanking(res.data);
  };

  // ================= SEARCH =================
  const handleSearch = async () => {
    if (!search) return loadProducts();
    const res = await API.get(`/products/search?keyword=${search}`);
    setProducts(res.data);
  };

  // ================= ADMIN API =================
  const insertOrder = async () => {
    await API.post(`/insert-order?order_id=${orderId}&customer_id=${customerId}&status=${status}`);
    alert("Inserted");
  };

  const deleteOrder = async () => {
    await API.delete(`/delete-order/${orderId}`);
    alert("Deleted");
  };

  const updateOrder = async () => {
    await API.put(`/update-status/${orderId}?status=${status}`);
    alert("Updated");
  };

  const loadOrders = async () => {
    const res = await API.get(`/orders-by-status?status=${status}`);
    setOrders(res.data);
  };

  // ================= ANALYSIS =================
  const runExplain = async (type) => {
    const res = await API.get(`/explain?query_type=${type}`);
    setPlan(res.data.plan);
  };

  // ================= INIT =================
  useEffect(() => {
    loadProducts();
  }, [page]);

  useEffect(() => {
    loadRanking();
  }, []);

  return (
    <div
      className="min-h-screen bg-gray-100"
      style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
    >

      {/* ================= HEADER ================= */}
      <header
        className="h-16 flex items-center px-6 text-white justify-between"
        style={{ backgroundColor: "rgb(8, 34, 55)" }}
      >
        <h1 className="font-bold text-lg">
          DBMS E-Commerce System
        </h1>

        <div className="flex gap-4">
          <button onClick={() => setTab("home")}>Home</button>
          <button onClick={() => setTab("admin")}>Admin</button>
          <button onClick={() => setTab("analysis")}>Analysis</button>
        </div>
      </header>

      {/* ================= HOME ================= */}
      {tab === "home" && (
        <div className="flex">

          {/* SIDEBAR */}
          <aside className="w-64 bg-white h-screen p-4 sticky top-0">
            <h2 className="font-semibold mb-3">🔥 Best Seller</h2>

            {ranking.map((item, i) => (
              <div key={i} className="text-sm mb-2">
                #{item.rank} - {item.product_id}
              </div>
            ))}
          </aside>

          {/* MAIN */}
          <main className="flex-1 p-6">

            {/* SEARCH */}
            <div className="flex gap-2 mb-4">
              <input
                className="border px-3 py-2 w-full"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button onClick={handleSearch} className="bg-black text-white px-4">
                Search
              </button>
            </div>

            {/* PRODUCTS */}
            <div className="grid grid-cols-4 gap-4">

              {products.map((p) => (
                <div key={p.product_id} className="bg-white p-4 rounded shadow">

                  <img
                    src={p.image}
                    className="h-52 w-full object-cover rounded"
                  />

                  <div className="mt-2 font-semibold">
                    {p.name}
                  </div>

                  <div className="text-red-600 font-bold">
                    {Number(p.price).toLocaleString()} đ
                  </div>

                  <div className="text-xs text-gray-500">
                    Sold: {p.sold_count}
                  </div>

                </div>
              ))}

            </div>

            {/* PAGINATION */}
            <div className="flex gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(p - 1, 1))}>
                Prev
              </button>
              <div>{page}</div>
              <button onClick={() => setPage(p => p + 1)}>
                Next
              </button>
            </div>

          </main>
        </div>
      )}

      {/* ================= ADMIN ================= */}
      {tab === "admin" && (
        <div className="p-6">

          <div className="bg-white p-4 rounded shadow">

            <h2 className="font-bold mb-3">ADMIN - ORDER CRUD</h2>

            <input placeholder="Order ID" onChange={e => setOrderId(e.target.value)} />
            <input placeholder="Customer ID" onChange={e => setCustomerId(e.target.value)} />
            <input placeholder="Status" onChange={e => setStatus(e.target.value)} />

            <div className="flex gap-2 mt-3">
              <button onClick={insertOrder}>Insert</button>
              <button onClick={deleteOrder}>Delete</button>
              <button onClick={updateOrder}>Update</button>
              <button onClick={loadOrders}>View</button>
            </div>

            <div className="mt-4">
              {orders.map((o, i) => (
                <div key={i}>
                  {o.order_id} - {o.order_status}
                </div>
              ))}
            </div>

          </div>

        </div>
      )}

      {/* ================= ANALYSIS ================= */}
      {tab === "analysis" && (
        <div className="p-6">

          <div className="bg-white p-4 rounded shadow">

            <h2 className="font-bold mb-3">DBMS QUERY ANALYSIS</h2>

            <div className="flex gap-2">
              <button onClick={() => runExplain("join")}>Join</button>
              <button onClick={() => runExplain("aggregate")}>Aggregate</button>
              <button onClick={() => runExplain("subquery")}>Subquery</button>
            </div>

            <pre className="mt-4 text-xs bg-gray-100 p-2">
              {plan}
            </pre>

          </div>

        </div>
      )}

    </div>
  );
}