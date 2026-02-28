'use client'

import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ContractContextProvider } from '../components/context';
import MerkleAirDrop from "@/components/merkleAirdrop";

export default function Home() {

  return (
    <div className="flex flex-col bg-merkle bg-cover min-h-screen bg-no-repeat">
      <ContractContextProvider>
      <Navbar />
      <MerkleAirDrop/>
      <Footer/>
      </ContractContextProvider>
    </div>
  );
}