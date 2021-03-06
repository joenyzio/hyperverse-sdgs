import {
  ReactNode,
  useCallback,
  useEffect,
  useState,
  createContext,
} from "react";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { providers } from "ethers";

const INFURA_ID = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!;

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider, // required
    options: {
      infuraId: INFURA_ID, // required
    },
  },
};

let web3Modal: Web3Modal;
if (typeof window !== "undefined") {
  web3Modal = new Web3Modal({
    network: "mainnet", // optional
    cacheProvider: true,
    providerOptions, // required
  });
}

type State = {
  provider: any | null;
  web3Provider: providers.Web3Provider | null;
  address: string | null;
  chainId: number | null;
  disconnect: () => void;
  connect: () => void;
};

export const Context = createContext<State>({
  provider: null,
  web3Provider: null,
  address: null,
  chainId: null,
  disconnect: () => {},
  connect: () => {},
});
Context.displayName = "EthereumContext";

export const Provider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Omit<State, "disconnect" | "connect">>({
    provider: null,
    web3Provider: null,
    address: null,
    chainId: null,
  });
  const { provider } = state;

  const connect = useCallback(async function() {
    // This is the initial `provider` that is returned when
    // using web3Modal to connect. Can be MetaMask or WalletConnect.
    const provider = await web3Modal.connect();

    // We plug the initial `provider` into ethers.js and get back
    // a Web3Provider. This will add on methods from ethers.js and
    // event listeners such as `.on()` will be different.
    const web3Provider = new providers.Web3Provider(provider);

    const signer = web3Provider.getSigner();
    const address = await signer.getAddress();

    const network = await web3Provider.getNetwork();

    setState((prev) => ({
      ...prev,
      provider,
      web3Provider,
      address,
      chainId: network.chainId,
    }));
  }, []);

  const disconnect = useCallback(
    async function() {
      await web3Modal.clearCachedProvider();
      if (provider?.disconnect && typeof provider.disconnect === "function") {
        await provider.disconnect();
      }

      setState({
        provider: null,
        web3Provider: null,
        address: null,
        chainId: null,
      });
    },
    [provider]
  );

  // Auto connect to the cached provider
  useEffect(() => {
    if (web3Modal.cachedProvider) {
      connect();
    }
  }, [connect]);

  // A `provider` should come with EIP-1193 events. We'll listen for those events
  // here so that when a user switches accounts or networks, we can update the
  // local React state with that new information.
  useEffect(() => {
    if (provider?.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        setState((prev) => ({ ...prev, address: accounts[0] }));
      };

      // https://docs.ethers.io/v5/concepts/best-practices/#best-practices--network-changes
      const handleChainChanged = (_hexChainId: string) => {
        window.location.reload();
      };

      const handleDisconnect = (error: { code: number; message: string }) => {
        disconnect();
      };

      provider.on("accountsChanged", handleAccountsChanged);
      provider.on("chainChanged", handleChainChanged);
      provider.on("disconnect", handleDisconnect);

      // Subscription Cleanup
      return () => {
        if (provider.removeListener) {
          provider.removeListener("accountsChanged", handleAccountsChanged);
          provider.removeListener("chainChanged", handleChainChanged);
          provider.removeListener("disconnect", handleDisconnect);
        }
      };
    }
  }, [provider, disconnect]);

  return (
    <Context.Provider value={{ ...state, disconnect, connect }}>
      {children}
    </Context.Provider>
  );
};
