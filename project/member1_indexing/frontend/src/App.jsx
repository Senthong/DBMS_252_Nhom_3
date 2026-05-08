import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import IndexingPage from './pages/IndexingPage';
import OrderListPage from './pages/OrderListPage';
import OrderDetailPage from './pages/OrderDetailPage';
import CreateOrderPage from './pages/CreateOrderPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/indexing" element={<Layout />}>
          <Route index element={<OrderListPage />} />
          <Route path="/indexing/benchmark" element={<IndexingPage />} />
          <Route path="/indexing/orders/:id" element={<OrderDetailPage />} />
          <Route path='/indexing/orders/new' element={<CreateOrderPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}