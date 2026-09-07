"use client";

import { useEffect, useState } from "react";
import { FaWhatsapp } from "react-icons/fa";
import { fetchSettingByKey } from "../../../utils/settingsApi";

const FALLBACK_NUMBER = "919729310456";

export default function WhatsAppButton() {
    const [phoneNumber, setPhoneNumber] = useState<string>(FALLBACK_NUMBER);

    useEffect(() => {
        fetchSettingByKey("whatsapp_number")
            .then((setting) => {
                if (setting?.value) setPhoneNumber(setting.value);
            })
            .catch(() => {/* use fallback */ });
    }, []);

    return (
        <a
            href={`https://wa.me/${phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="hidden md:block fixed bottom-6 right-6 z-50 group"
        >
            {/* Pulsing ring */}
            {/* <span className="absolute inset-0 rounded-full bg-[#25D366] animate-whatsapp-ring" /> */}
            {/*  animate-whatsapp-jump */}

            {/* Button */}
            <span className="relative flex items-center justify-center w-14 h-14 bg-[#25D366] rounded-full shadow-lg group-hover:bg-[#1ebe5d] transition-colors duration-300">
                <FaWhatsapp className="text-white text-3xl" />
            </span>
        </a>
    );
}

