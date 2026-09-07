import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string; // e.g., 'max-w-xl', 'max-w-2xl'
  zIndex?: string; // Allow custom z-index
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  width = 'max-w-xl',
  zIndex = 'z-[9999]',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="backdrop"
          className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/20 backdrop-blur-sm overflow-y-auto py-10 px-4`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose} // Close when backdrop is clicked
        >
          <motion.div
            key="modal"
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`w-full ${width}   text-white bg-white rounded-2xl shadow-xl p-6 relative`}
            onClick={(e) => e.stopPropagation()} // Prevent backdrop close when clicking modal content
          >
            <button
              type='button'
              onClick={onClose}
              className="absolute top-3 right-3 text-black hover:text-red-400 text-4xl"
              aria-label="Close modal"
            >
              &times;
            </button>

            <h2 className="text-xl font-semibold mb-4 text-black">{title}</h2>

            <div className="overflow-y-auto overflow-x-hidden max-h-[78vh] px-2 py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
