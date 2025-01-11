import Footer from './Footer';
import Header from './Header';
import { useRouter } from 'next/router';

const Layout = ({ children }) => {
  const router = useRouter();
  const hideFooterPaths = ['/avcomputers', '/dashboard', '/chat']; // Pages where footer should be hidden

  return (
    <>
      <Header />
      {children}
      {!hideFooterPaths.includes(router.pathname) && (
        <Footer />
      )}
    </>
  );
};

export default Layout;
