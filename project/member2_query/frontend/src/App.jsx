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

  // ================= SELLER =================
  const [orderId, setOrderId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("created");
  const [orders, setOrders] = useState([]);

  // ================= ANALYSIS =================
  const [plan, setPlan] = useState([]);
  const [queryTitle, setQueryTitle] = useState("");
  const [querySQL, setQuerySQL] = useState("");
  const [queryResult, setQueryResult] = useState([]);

  // ================= LOAD PRODUCTS =================
  const loadProducts = async () => {
    const res = await API.get(
      `/products?page=${page}&limit=8`
    );

    setProducts(res.data);
  };

  const loadRanking = async () => {
    const res = await API.get(
      "/products/ranking"
    );

    setRanking(res.data);
  };

  // ================= SEARCH =================
  const handleSearch = async () => {

    if (!search) {
      return loadProducts();
    }

    const res = await API.get(
      `/products/search?keyword=${search}`
    );

    setProducts(res.data);
  };

  // ================= SELLER =================
  const insertOrder = async () => {

    await API.post(
      `/insert-order?order_id=${orderId}&customer_id=${customerId}&status=${status}`
    );

    alert("Inserted");
  };

  const deleteOrder = async () => {

    await API.delete(
      `/delete-order/${orderId}`
    );

    alert("Deleted");
  };

  const updateOrder = async () => {

    await API.put(
      `/update-status/${orderId}?status=${status}`
    );

    alert("Updated");
  };

  const loadOrders = async () => {

    const res = await API.get(
      `/orders-by-status?status=${status}`
    );

    setOrders(res.data);
  };

  // ================= EXPLAIN =================
  const runExplain = async (type) => {

    const res = await API.get(
      `/explain?query_type=${type}`
    );

    setPlan(res.data.plan);
  };

  // ================= QUERY PROCESSING =================
  const runSingle = async () => {

    setQueryTitle("Single Condition Query");

    setQuerySQL(`
SELECT order_id, order_status
FROM orders
WHERE order_status = 'delivered'
LIMIT 20;
    `);

    const res = await API.get(
      "/orders-by-status?status=delivered"
    );

    setQueryResult(res.data);
  };

  const runComposite = async () => {

    setQueryTitle("Composite Condition Query");

    setQuerySQL(`
SELECT o.order_id, c.customer_state
FROM orders o
JOIN customers c USING(customer_id)
WHERE o.order_status = 'delivered'
AND c.customer_state = 'SP'
LIMIT 20;
    `);

    const res = await API.get(
      "/orders-composite?status=delivered&state=SP"
    );

    setQueryResult(res.data);
  };

  const runJoin = async () => {

    setQueryTitle("Join Query");

    setQuerySQL(`
SELECT o.order_id, oi.product_id, oi.price
FROM orders o
JOIN order_items oi USING(order_id)
LIMIT 20;
    `);

    const res = await API.get(
      "/orders-with-items"
    );

    setQueryResult(res.data);
  };

  const runSubquery = async () => {

    setQueryTitle("Subquery");

    setQuerySQL(`
SELECT order_id
FROM orders
WHERE order_id IN (
    SELECT order_id
    FROM order_payments
    WHERE payment_value >
    (
        SELECT AVG(payment_value)
        FROM order_payments
    )
)
LIMIT 20;
    `);

    const res = await API.get(
      "/high-value-orders"
    );

    setQueryResult(res.data);
  };

  const runAggregate = async () => {

    setQueryTitle("Aggregate Query");

    setQuerySQL(`
SELECT c.customer_state,
COUNT(o.order_id) AS total_orders,
SUM(op.payment_value) AS total_revenue
FROM orders o
JOIN customers c USING(customer_id)
JOIN order_payments op USING(order_id)
GROUP BY c.customer_state
ORDER BY total_revenue DESC
LIMIT 10;
    `);

    const res = await API.get(
      "/revenue-by-state"
    );

    setQueryResult(res.data);
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
      style={{
        fontFamily:
          "'Hedvig Letters Serif', serif"
      }}
    >

      {/* ================= HEADER ================= */}
      <header
        className="
          h-16
          flex
          items-center
          justify-between
          px-6
          text-white
        "
        style={{
          backgroundColor: "rgb(8, 34, 55)"
        }}
      >

        <h1 className="font-bold text-xl">
          DBMS E-Commerce System
        </h1>

        <div className="flex gap-6">

          <button
            onClick={() => setTab("home")}
          >
            Home
          </button>

          <button
            onClick={() => setTab("seller")}
          >
            Seller
          </button>

          <button
            onClick={() => setTab("analysis")}
          >
            Analysis
          </button>

        </div>

      </header>

      {/* ================= HOME ================= */}
      {tab === "home" && (

        <div className="flex">

          {/* SIDEBAR */}
          <aside
            className="
              w-64
              bg-white
              p-5
              h-screen
              sticky
              top-0
              shadow
            "
          >

            <h2
              className="
                font-bold
                text-lg
                mb-5
              "
            >
              🔥 Best Seller
            </h2>

            <div className="space-y-3">

              {ranking.map((item, i) => (

                <div
                  key={i}
                  className="
                    bg-gray-100
                    p-3
                    rounded-xl
                    text-sm
                  "
                >
                  #{item.rank} — {item.product_id}
                </div>

              ))}

            </div>

          </aside>

          {/* MAIN */}
          <main className="flex-1 p-6">

            {/* SEARCH */}
            <div className="flex gap-3 mb-6">

              <input
                className="
                  border
                  p-3
                  rounded-xl
                  w-full
                "
                placeholder="Search products..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

              <button
                onClick={handleSearch}
                className="
                  bg-black
                  text-white
                  px-6
                  rounded-xl
                "
              >
                Search
              </button>

            </div>

            {/* PRODUCTS */}
            <div className="grid grid-cols-4 gap-6">

              {products.map((p) => (

                <div
                  key={p.product_id}
                  className="
                    bg-white
                    rounded-3xl
                    shadow-md
                    overflow-hidden
                    hover:shadow-2xl
                    transition
                  "
                >

                  <img
                    src={p.image}
                    className="
                      h-56
                      w-full
                      object-cover
                    "
                  />

                  <div className="p-4">

                    <div
                      className="
                        font-semibold
                        mb-2
                      "
                    >
                      {p.name}
                    </div>

                    <div
                      className="
                        text-red-600
                        font-bold
                        text-lg
                      "
                    >
                      {Number(p.price).toLocaleString()} đ
                    </div>

                    <div
                      className="
                        text-sm
                        text-gray-500
                        mt-1
                      "
                    >
                      Sold: {p.sold_count}
                    </div>

                  </div>

                </div>

              ))}

            </div>

            {/* PAGINATION */}
            <div className="flex gap-4 mt-8">

              <button
                onClick={() =>
                  setPage((p) =>
                    Math.max(p - 1, 1)
                  )
                }
                className="
                  bg-white
                  px-5
                  py-2
                  rounded-xl
                  shadow
                "
              >
                Prev
              </button>

              <div
                className="
                  flex
                  items-center
                  font-bold
                "
              >
                {page}
              </div>

              <button
                onClick={() =>
                  setPage((p) => p + 1)
                }
                className="
                  bg-white
                  px-5
                  py-2
                  rounded-xl
                  shadow
                "
              >
                Next
              </button>

            </div>

          </main>

        </div>

      )}

      {/* ================= SELLER ================= */}
      {tab === "seller" && (

        <div className="p-8">

          <div
            className="
              bg-white
              rounded-3xl
              shadow
              p-8
            "
          >

            <h2
              className="
                text-3xl
                font-bold
                mb-8
              "
            >
              Seller Dashboard
            </h2>

            {/* FORM */}
            <div className="grid grid-cols-3 gap-4">

              <input
                placeholder="Order ID"
                className="
                  border
                  p-3
                  rounded-xl
                "
                onChange={(e) =>
                  setOrderId(e.target.value)
                }
              />

              <input
                placeholder="Customer ID"
                className="
                  border
                  p-3
                  rounded-xl
                "
                onChange={(e) =>
                  setCustomerId(e.target.value)
                }
              />

              <input
                placeholder="Status"
                className="
                  border
                  p-3
                  rounded-xl
                "
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              />

            </div>

            {/* BUTTONS */}
            <div className="flex gap-4 mt-6">

              <button
                onClick={insertOrder}
                className="
                  bg-green-600
                  text-white
                  px-6
                  py-3
                  rounded-xl
                "
              >
                Insert
              </button>

              <button
                onClick={deleteOrder}
                className="
                  bg-red-600
                  text-white
                  px-6
                  py-3
                  rounded-xl
                "
              >
                Delete
              </button>

              <button
                onClick={updateOrder}
                className="
                  bg-blue-600
                  text-white
                  px-6
                  py-3
                  rounded-xl
                "
              >
                Update
              </button>

              <button
                onClick={loadOrders}
                className="
                  bg-black
                  text-white
                  px-6
                  py-3
                  rounded-xl
                "
              >
                View
              </button>

            </div>

            {/* TABLE */}
            <div className="mt-8 overflow-x-auto">

              <table className="w-full">

                <thead className="bg-gray-100">

                  <tr>

                    <th className="p-4 text-left">
                      Order ID
                    </th>

                    <th className="p-4 text-left">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {orders.map((o, i) => (

                    <tr
                      key={i}
                      className="
                        border-b
                      "
                    >

                      <td className="p-4">
                        {o.order_id}
                      </td>

                      <td className="p-4">
                        {o.order_status}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      )}

      {/* ================= ANALYSIS ================= */}
      {tab === "analysis" && (

        <div className="p-8">

          {/* TITLE */}
          <div className="mb-8">

            <h2
              className="
                text-4xl
                font-bold
                text-gray-800
              "
            >
              Query Analysis Dashboard
            </h2>

            <p
              className="
                text-gray-500
                mt-2
              "
            >
              PostgreSQL Query Processing Visualization
            </p>

          </div>

          {/* EXPLAIN CARDS */}
          <div className="grid grid-cols-3 gap-6">

            <div
              onClick={() =>
                runExplain("join")
              }
              className="
                bg-white
                p-6
                rounded-3xl
                shadow
                cursor-pointer
                hover:shadow-2xl
                transition
              "
            >

              <div className="text-5xl mb-4">
                🔗
              </div>

              <h3 className="text-2xl font-bold">
                Join Query
              </h3>

              <p className="text-gray-500 mt-2">
                Analyze JOIN execution
              </p>

            </div>

            <div
              onClick={() =>
                runExplain("aggregate")
              }
              className="
                bg-white
                p-6
                rounded-3xl
                shadow
                cursor-pointer
                hover:shadow-2xl
                transition
              "
            >

              <div className="text-5xl mb-4">
                📊
              </div>

              <h3 className="text-2xl font-bold">
                Aggregate
              </h3>

              <p className="text-gray-500 mt-2">
                Analyze GROUP BY
              </p>

            </div>

            <div
              onClick={() =>
                runExplain("subquery")
              }
              className="
                bg-white
                p-6
                rounded-3xl
                shadow
                cursor-pointer
                hover:shadow-2xl
                transition
              "
            >

              <div className="text-5xl mb-4">
                🧠
              </div>

              <h3 className="text-2xl font-bold">
                Subquery
              </h3>

              <p className="text-gray-500 mt-2">
                Analyze nested queries
              </p>

            </div>

          </div>

          {/* EXPLAIN TERMINAL */}
          <div className="mt-10">

            <div
              className="
                rounded-3xl
                overflow-hidden
                shadow-2xl
              "
            >

              <div
                className="
                  bg-[#161b22]
                  px-5
                  py-4
                  text-gray-300
                  font-mono
                "
              >
                PostgreSQL EXPLAIN ANALYZE
              </div>

              <div
                className="
                  bg-[#0d1117]
                  p-6
                  min-h-[350px]
                "
              >

                {plan.length > 0 ? (

                  <pre
                    className="
                      text-green-400
                      whitespace-pre-wrap
                      font-mono
                      text-sm
                      leading-7
                    "
                  >
                    {plan.join("\n")}
                  </pre>

                ) : (

                  <div
                    className="
                      h-full
                      flex
                      items-center
                      justify-center
                    "
                  >

                    <div className="text-center">

                      <div className="text-6xl mb-4">
                        🖥️
                      </div>

                      <p className="text-gray-400">
                        Run EXPLAIN ANALYZE
                      </p>

                    </div>

                  </div>

                )}

              </div>

            </div>

          </div>

          {/* QUERY PLAYGROUND */}
          <div className="mt-10">

            <div
              className="
                bg-white
                rounded-3xl
                shadow
                overflow-hidden
              "
            >

              {/* HEADER */}
              <div
                className="
                  bg-[#082237]
                  text-white
                  px-6
                  py-5
                "
              >

                <h2 className="text-2xl font-bold">
                  Query Processing Playground
                </h2>

                <p className="text-gray-300 mt-2">
                  Execute DBMS query types
                </p>

              </div>

              {/* BUTTONS */}
              <div
                className="
                  grid
                  grid-cols-5
                  gap-4
                  p-6
                  bg-gray-100
                "
              >

                <button
                  onClick={runSingle}
                  className="
                    bg-blue-600
                    text-white
                    p-4
                    rounded-2xl
                  "
                >
                  Single
                </button>

                <button
                  onClick={runComposite}
                  className="
                    bg-purple-600
                    text-white
                    p-4
                    rounded-2xl
                  "
                >
                  Composite
                </button>

                <button
                  onClick={runJoin}
                  className="
                    bg-green-600
                    text-white
                    p-4
                    rounded-2xl
                  "
                >
                  Join
                </button>

                <button
                  onClick={runSubquery}
                  className="
                    bg-orange-600
                    text-white
                    p-4
                    rounded-2xl
                  "
                >
                  Subquery
                </button>

                <button
                  onClick={runAggregate}
                  className="
                    bg-red-600
                    text-white
                    p-4
                    rounded-2xl
                  "
                >
                  Aggregate
                </button>

              </div>

              {/* SQL */}
              {querySQL && (

                <div className="bg-[#161b22] p-6">

                  <pre
                    className="
                      text-cyan-400
                      font-mono
                      text-sm
                      whitespace-pre-wrap
                    "
                  >
                    {querySQL}
                  </pre>

                </div>

              )}

              {/* RESULT */}
              <div
                className="
                  bg-[#0d1117]
                  p-6
                  min-h-[400px]
                "
              >

                {queryResult.length > 0 ? (

                  <div>

                    {/* TITLE */}
                    <div className="mb-6">

                      <h3
                        className="
                          text-2xl
                          font-bold
                          text-white
                        "
                      >
                        {queryTitle}
                      </h3>

                      <p className="text-gray-400 mt-2">
                        Showing {queryResult.length} rows
                      </p>

                    </div>

                    {/* TABLE */}
                    <div
                      className="
                        overflow-x-auto
                        rounded-2xl
                        border
                        border-gray-800
                      "
                    >

                      <table className="w-full">

                        <thead className="bg-[#161b22]">

                          <tr>

                            {Object.keys(
                              queryResult[0]
                            ).map((key) => (

                              <th
                                key={key}
                                className="
                                  px-6
                                  py-4
                                  text-left
                                  text-cyan-400
                                  uppercase
                                  text-sm
                                  border-b
                                  border-gray-700
                                "
                              >
                                {key}
                              </th>

                            ))}

                          </tr>

                        </thead>

                        <tbody>

                          {queryResult.map(
                            (row, index) => (

                              <tr
                                key={index}
                                className={`
                                  border-b border-gray-800
                                  hover:bg-[#161b22]
                                  transition
                                  ${
                                    index % 2 === 0
                                      ? "bg-[#0d1117]"
                                      : "bg-[#111827]"
                                  }
                                `}
                              >

                                {Object.values(row).map(
                                  (value, i) => (

                                    <td
                                      key={i}
                                      className="
                                        px-6
                                        py-4
                                        text-green-400
                                        font-mono
                                        text-sm
                                      "
                                    >
                                      {String(value)}
                                    </td>

                                  )
                                )}

                              </tr>

                            )
                          )}

                        </tbody>

                      </table>

                    </div>

                  </div>

                ) : (

                  <div
                    className="
                      h-full
                      flex
                      items-center
                      justify-center
                    "
                  >

                    <div className="text-center">

                      <div className="text-6xl mb-4">
                        📊
                      </div>

                      <p className="text-gray-400">
                        Execute a query
                      </p>

                    </div>

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}