import { useEffect, useState } from 'react';
import MobileDashboardHeader from './MobileDashboardHeader';
import DesktopDashboardHeader from './DesktopDashboardHeader';
import { useMediaQuery } from '../hooks/useMediaQuery';

const DashboardHeader = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isClient, setIsClient] = useState(false);

  // Ensure we only render the appropriate component on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return isMobile ? <MobileDashboardHeader /> : <DesktopDashboardHeader />;
};

export default DashboardHeader;