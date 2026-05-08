import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Import axios

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Khởi tạo state cho form
  const [formData, setFormData] = useState({
    customer_id: '',
    order_id: '',
    order_status: '',
    order_purchase_timestamp: new Date().toISOString().slice(0, 16)
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Format lại timestamp sang chuẩn ISO 8601 (có chữ Z ở cuối)
      const payload = {
        ...formData,
        order_purchase_timestamp: new Date(formData.order_purchase_timestamp).toISOString()
      };

      // Sử dụng axios.post thay cho fetch
      await axios.post('http://localhost:8001/api/orders', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Nếu API trả về status 2xx, axios sẽ chạy tiếp xuống đây
      alert('Tạo đơn hàng thành công!');
      navigate('/indexing/'); // Chuyển về trang danh sách đơn hàng sau khi tạo

    } catch (err) {
      console.error('Lỗi khi tạo đơn hàng:', err);
      
      // Xử lý lỗi riêng biệt của Axios
      if (err.response) {
        // Server có trả về response nhưng với mã lỗi (vd: 422, 400, 500)
        const errorData = err.response.data;
        setError(errorData.detail?.[0]?.msg || errorData.message || 'Có lỗi xảy ra khi tạo đơn hàng.');
      } else if (err.request) {
        // Đã gửi request nhưng không nhận được phản hồi (vd: server sập, sai port)
        setError('Không thể kết nối đến server. Vui lòng kiểm tra lại backend.');
      } else {
        // Lỗi phát sinh trong quá trình setup request
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-3xl font-light tracking-wide mb-8 text-center uppercase">
          Create New Order
        </h1>

        {error && (
          <div className="mb-6 p-4 text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Order ID
            </label>
            <input
              type="text"
              name="order_id"
              value={formData.order_id}
              onChange={handleInputChange}
              required
              className="w-full border-b border-gray-300 py-2 bg-transparent focus:outline-none focus:border-black transition-colors"
              placeholder="e.g. ORD-2026-001"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Customer ID
            </label>
            <input
              type="text"
              name="customer_id"
              value={formData.customer_id}
              onChange={handleInputChange}
              required
              className="w-full border-b border-gray-300 py-2 bg-transparent focus:outline-none focus:border-black transition-colors"
              placeholder="e.g. CUST-9876"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Order Status
            </label>
            <select
              name="order_status"
              value={formData.order_status}
              onChange={handleInputChange}
              required
              className="w-full border-b border-gray-300 py-2 bg-transparent focus:outline-none focus:border-black transition-colors appearance-none rounded-none"
            >
              <option value="" disabled>Select a status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Purchase Timestamp
            </label>
            <input
              type="datetime-local"
              name="order_purchase_timestamp"
              value={formData.order_purchase_timestamp}
              onChange={handleInputChange}
              required
              className="w-full border-b border-gray-300 py-2 bg-transparent focus:outline-none focus:border-black transition-colors"
            />
          </div>

          <div className="pt-6 flex flex-col space-y-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-4 text-sm font-medium uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            >
              {isLoading ? 'Submitting...' : 'Save Order'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/indexing/')}
              className="w-full bg-transparent text-black border border-black py-4 text-sm font-medium uppercase tracking-widest hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderPage;