import Link from "next/link";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white shadow-lg rounded-2xl p-10 max-w-md text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600 text-lg">
          You do not have permission to view this page.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
