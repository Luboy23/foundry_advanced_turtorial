"use client";

import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import Faucet from "@/components/faucet";

import { ContractContextProvider } from "../components/context";

export default function Home() {
  return (
    <div className="bg-faucet bg-cover min-h-screen bg-no-repeat">
      <ContractContextProvider>
        <Navbar />
        <Faucet />
        <Footer />
      </ContractContextProvider>
    </div>
  );
}
