"use client";
import { useLoader } from "../../context/LoaderContext";

const GlobalLoader = () => {
  const { loading } = useLoader();

  if (!loading) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/0 backdrop-blur-xs flex items-center justify-center z-[9999]">
      <div
        className="w-20 h-20 border-4 border-transparent text-white text-4xl animate-spin flex items-center justify-center border-t-white rounded-full"
      >
        <div
          className="w-16 h-16 border-4 border-transparent text-[#007FFF] text-2xl animate-spin flex items-center justify-center border-t-[#007FFF] rounded-full"
        ></div>
      </div>
    </div>
  );
};

export default GlobalLoader;
