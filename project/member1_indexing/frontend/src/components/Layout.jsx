import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Navbar mang phong cách tối giản */}
      <nav className="bg-white shadow-sm px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-wider uppercase">Olist Admin</h1>
        <div className="space-x-6 text-sm font-medium">
          <Link to="/indexing" className="hover:text-blue-600 transition">Orders</Link>
          <Link to="/indexing/benchmark" className="hover:text-purple-600 transition">Indexing Benchmarks</Link>
        </div>
      </nav>

      {/* Nội dung của từng trang sẽ render ở đây */}
      <main className="p-8 max-w-7xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}