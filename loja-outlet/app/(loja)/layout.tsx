import { Header, Footer } from "@/components/StoreChrome";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (<><Header /><main>{children}</main><Footer /></>);
}
