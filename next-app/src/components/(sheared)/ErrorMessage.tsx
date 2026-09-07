import { BadgeX } from "lucide-react";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ErrorMessageProps {
  message: string;
  onClose: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onClose }) => {
  const latestOnClose = useRef(onClose);

  useEffect(() => {
    latestOnClose.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const duration = Math.min(15000, Math.max(3000, message.length * 80));
    const timer = setTimeout(() => {
      latestOnClose.current();
    }, duration);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={{ duration: 0.3 }}
      className="fixed top-5 right-5 z-[10000] flex items-center space-x-3 rounded-lg bg-white border-l-4 border-red-600 shadow-md px-6 py-4 max-w-sm"
    >
      <BadgeX className="h-5 w-5 text-red-600" />
      <span className="text-sm font-semibold">{message}</span>
      <button
        onClick={onClose}
        className="ml-3 text-red-600 hover:text-red-800 text-lg leading-none focus:outline-none"
      >
        ✕
      </button>
    </motion.div>
  );
};

export default ErrorMessage;



