import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/Header';
import styles from '../styles/SendNotification.module.css';

const SendNotification = () => {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('');
  const [url, setUrl] = useState('https://');
  const [image, setImage] = useState('');

  useEffect(() => {
    if (!loading && (!isLoggedIn || !isAdmin)) {
      router.push('/'); // Redirect to home if not logged in or not an admin
    }
  }, [isLoggedIn, isAdmin, loading, router]);

  const handleUrlChange = (e) => {
    let inputUrl = e.target.value;
    if (inputUrl && !inputUrl.startsWith('http')) {
      inputUrl = `https://${inputUrl}`;
    }
    setUrl(inputUrl);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch('/api/sendNotificationToAll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, icon, url, image }),
    });

    if (res.ok) {
      alert('Notification sent successfully');
      setTitle('');
      setBody('');
      setIcon('');
      setUrl('https://');
      setImage('');
    } else {
      alert('Failed to send notification');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <div>Access Denied</div>; // Show access denied message if not an admin
  }

  return (
    <>
      <Header />
      <div className={styles.container}>
        <h1>Send Notification</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
            className={styles.input}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message here"
            required
            className={styles.textarea}
          />
          <input
            type="text"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            placeholder="Icon URL"
            className={styles.input}
          />
          <input
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="Click URL"
            className={styles.input}
          />
          <input
            type="text"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="Image URL"
            className={styles.input}
          />
          <button type="submit" className={styles.button}>Send</button>
        </form>
      </div>
    </>
  );
};

export default SendNotification;
