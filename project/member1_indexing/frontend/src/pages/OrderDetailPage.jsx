import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:8001';

export default function OrderDetailPage() {
  const { id } = useParams(); // Lấy order_id từ URL
  const [orderDetail, setOrderDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await axios.get(`/api/orders/${id}`);
        setOrderDetail(res.data);
      } catch (err) {
        console.error(err);
        setError('Không tìm thấy đơn hàng hoặc có lỗi xảy ra.');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (loading) return <div className="py-20 text-center text-gray-500">Đang tải thông tin...</div>;
  if (error) return <div className="py-20 text-center text-red-500">{error}</div>;
  if (!orderDetail) return null;

  const { order_info, items } = orderDetail;

  // Tính tổng tiền đơn hàng
  const totalAmount = items.reduce((sum, item) => sum + Number(item.price) + Number(item.freight_value), 0);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Nút quay lại */}
      <div className="mb-6">
        <Link to="/indexing/" className="text-gray-500 hover:text-black flex items-center text-sm transition">
          <span className="mr-2">←</span> Back to Orders
        </Link>
      </div>

      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="text-3xl font-light mb-1">Order Details</h2>
          <p className="text-gray-500 font-mono text-sm">{order_info.order_id}</p>
        </div>
        <span className={`px-4 py-2 text-sm uppercase tracking-wider font-medium ${
          order_info.order_status === 'delivered' ? 'bg-green-100 text-green-800' : 
          order_info.order_status === 'canceled' ? 'bg-red-100 text-red-800' : 
          'bg-yellow-100 text-yellow-800'
        }`}>
          {order_info.order_status}
        </span>
      </div>

      {/* Thông tin chung */}
      <div className="bg-white p-6 shadow-sm border border-gray-100 mb-8 grid grid-cols-2 gap-8">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Customer Info</h3>
          <p className="font-mono text-sm">{order_info.customer_id}</p>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Order Date</h3>
          <p className="text-sm">{formatDate(order_info.order_purchase_timestamp)}</p>
        </div>
      </div>

      {/* Danh sách sản phẩm (Items) */}
      <h3 className="text-lg font-medium mb-4">Order Items ({items.length})</h3>
      <div className="bg-white shadow-sm border border-gray-100 overflow-hidden mb-6">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 font-medium">Product ID</th>
              <th className="p-4 font-medium text-right">Price</th>
              <th className="p-4 font-medium text-right">Freight (Shipping)</th>
              <th className="p-4 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const subtotal = Number(item.price) + Number(item.freight_value);
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="p-4 font-mono text-xs text-gray-600">{item.product_id || 'Unknown'}</td>
                  <td className="p-4 text-right">${Number(item.price).toFixed(2)}</td>
                  <td className="p-4 text-right">${Number(item.freight_value).toFixed(2)}</td>
                  <td className="p-4 text-right font-medium">${subtotal.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tổng tiền */}
      <div className="flex justify-end">
        <div className="bg-gray-50 p-6 border border-gray-100 w-72 flex justify-between items-center">
          <span className="font-medium text-gray-600">Total</span>
          <span className="text-2xl font-light">${totalAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}