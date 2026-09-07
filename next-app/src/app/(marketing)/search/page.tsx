"use client";

import { Suspense } from "react";
import SearchPage from "./SearchPageContent";

export default function SearchWrapper() {
    return (
        <Suspense fallback={<div>Loading search...</div>}>
            <SearchPage />
        </Suspense>
    );

}
