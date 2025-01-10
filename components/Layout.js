import Footer from './Footer';
import Header from './Header';
import { useRouter } from 'next/router';

const Layout = ({ children }) => {
  const router = useRouter();
  const isChat = router.pathname === '/chat';

  return (
    <>
      <Header />
      {children}
      {!isChat && <Footer />}
    </>
  );
};

export default Layout;
