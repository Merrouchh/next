import React, { useState } from 'react';

const NumberDisplay = ({ number }) => {
  const [displayText, setDisplayText] = useState(number);

  const handleCopy = () => {
    // Copy the number to the clipboard
    navigator.clipboard.writeText(number).then(() => {
      // Change the display text to "Copied"
      setDisplayText('Copied');

      // Revert back to the original number after 2 seconds
      setTimeout(() => {
        setDisplayText(number);
      }, 2000);
    });
  };

  return (
    <div>
      <span onClick={handleCopy} style={{ cursor: 'pointer', fontSize: '24px', color: '#FFD700' }}>
        {displayText}
      </span>
    </div>
  );
};

export default NumberDisplay; 