"use client";

import MintERC20 from "@/components/erc20mint";
import Footer from "@/components/footer";
import Navbar from "@/components/navbar";
import { useState } from "react";

export default function Home() {
  const [accounts, setAccounts] = useState([]);

  return (
    <>
      <div className="bg-erc20mint bg-cover min-h-screen bg-no-repeat">
        <Navbar accounts={accounts} setAccounts={setAccounts} />
        <MintERC20 accounts={accounts} setAccounts={setAccounts} />
        <Footer />
      </div>
    </>
  );
}
