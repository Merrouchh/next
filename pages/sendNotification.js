import { useState } from 'react';

export default function SendNotification() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState('');

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
      setUrl('');
      setImage('');
    } else {
      alert('Failed to send notification');
    }
  };

  return (
    <div>
      <h1>Send Notification</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          required
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type your message here"
          required
        />
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="Icon URL"
        />
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="Click URL"
        />
        <input
          type="text"
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="Image URL"
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
