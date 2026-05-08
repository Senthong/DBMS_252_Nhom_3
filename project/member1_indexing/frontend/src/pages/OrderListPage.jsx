import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

// Thiết lập Base URL để không phải gõ lại localhost:8001 nhiều lần
// Trong thực tế, bạn có thể đưa cấu hình này vào file riêng hoặc .env
axios.defaults.baseURL = 'http://localhost:8001';

export default function OrderListPage() {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    customer_id: ''
  });

  // 1. Hàm gọi API Lấy danh sách & Tìm kiếm (GET)
  const fetchOrders = async () => {
    try {
      // Axios sẽ tự động chuyển filters thành query string: ?status=...&customer_id=...
      const res = await axios.get('/api/orders/', { params: filters });
      setOrders(res.data);
    } catch (error) {
      console.error("Lỗi khi tải đơn hàng", error);
      alert("Không thể kết nối đến máy chủ FastAPI!");
    }
  };

  // Tự động chạy fetchOrders lần đầu khi load trang
  useEffect(() => {
    fetchOrders();
  }, []);

  // Xử lý sự kiện Submit form tìm kiếm
  const handleSearch = (e) => {
    e.preventDefault();
    fetchOrders();
  };

  // 2. Hàm gọi API Xóa đơn hàng (DELETE)
  const handleDelete = async (orderId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa đơn hàng này cùng các dữ liệu liên quan?")) return;
    
    try {
      await axios.delete(`/api/orders/${orderId}`);
      alert("Đã xóa đơn hàng thành công!");
      fetchOrders(); // Tải lại danh sách sau khi xóa
    } catch (error) {
      console.error("Lỗi khi xóa đơn hàng", error);
      alert("Có lỗi xảy ra khi xóa!");
    }
  };

  // Hàm format ngày tháng cho đẹp
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN'); // Hiển thị theo giờ Việt Nam
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-light">Order Management</h2>
        <Link to="/indexing/orders/new" 
          className="bg-black text-white px-5 py-2 text-sm hover:bg-gray-800 transition"
        >
          + New Order
        </Link>
      </div>

      {/* Form Tìm kiếm (Test Indexing) */}
      <form onSubmit={handleSearch} className="bg-white p-4 shadow-sm border border-gray-100 flex gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Customer ID..." 
          className="border border-gray-300 px-3 py-2 w-64 text-sm focus:outline-none focus:border-black"
          value={filters.customer_id}
          onChange={(e) => setFilters({...filters, customer_id: e.target.value})}
        />
        <select 
          className="border border-gray-300 px-3 py-2 w-48 text-sm focus:outline-none focus:border-black"
          value={filters.status}
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="delivered">Delivered</option>
          <option value="shipped">Shipped</option>
          <option value="canceled">Canceled</option>
          <option value="invoiced">Invoiced</option>
          <option value="processing">Processing</option>
        </select>
        <button type="submit" className="bg-gray-100 border border-gray-300 px-4 py-2 text-sm hover:bg-gray-200">
          Search
        </button>
      </form>

      {/* Bảng Hiển thị */}
      <div className="bg-white shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-medium">Order ID</th>
              <th className="p-4 font-medium">Customer ID</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Purchase Date</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">Không tìm thấy đơn hàng nào.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.order_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs" title={order.order_id}>{order.order_id.substring(0, 8)}...</td>
                  <td className="p-4 font-mono text-xs text-gray-500" title={order.customer_id}>{order.customer_id.substring(0, 8)}...</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs uppercase tracking-wider ${
                      order.order_status === 'delivered' ? 'bg-green-100 text-green-800' : 
                      order.order_status === 'canceled' ? 'bg-red-100 text-red-800' : 
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {order.order_status}
                    </span>
                  </td>
                  {/* Chú ý: Backend trả về order_purchase_timestamp thay vì date */}
                  <td className="p-4 text-gray-500">{formatDate(order.order_purchase_timestamp)}</td>
                  <td className="p-4 space-x-3">
                    <Link 
                        to={`/indexing/orders/${order.order_id}`} 
                        className="text-blue-600 hover:underline"
                        >
                        View
                    </Link>
                    <button 
                      className="text-red-600 hover:underline"
                      onClick={() => handleDelete(order.order_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}