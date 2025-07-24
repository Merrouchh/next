import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FaInfo } from 'react-icons/fa';
import styles from '../../styles/EventDetail.module.css';

const EventDescription = ({ event }) => {
  return (
    <section className={styles.eventDescriptionSection}>
      <h2 className={styles.sectionHeading}>
        <FaInfo /> Event Details
      </h2>
      <div className={styles.eventDescription}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Custom link component that opens external links in new tab
            a: ({ node, ...props }) => {
              const isExternal = props.href?.startsWith('http');
              return (
                <a 
                  {...props} 
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className={styles.markdownLink}
                />
              );
            },
            // Custom heading components
            h1: ({ node, ...props }) => <h1 className={styles.markdownH1} {...props} />,
            h2: ({ node, ...props }) => <h2 className={styles.markdownH2} {...props} />,
            h3: ({ node, ...props }) => <h3 className={styles.markdownH3} {...props} />,
            // Custom list components
            ul: ({ node, ...props }) => <ul className={styles.markdownList} {...props} />,
            ol: ({ node, ...props }) => <ol className={styles.markdownList} {...props} />,
            // Custom code components
            code: ({ node, inline, ...props }) => (
              inline ? 
                <code className={styles.markdownInlineCode} {...props} /> :
                <code className={styles.markdownCode} {...props} />
            ),
            // Custom blockquote
            blockquote: ({ node, ...props }) => <blockquote className={styles.markdownBlockquote} {...props} />,
            // Custom table components
            table: ({ node, ...props }) => <table className={styles.markdownTable} {...props} />,
            th: ({ node, ...props }) => <th className={styles.markdownTh} {...props} />,
            td: ({ node, ...props }) => <td className={styles.markdownTd} {...props} />,
          }}
        >
          {event.description}
        </ReactMarkdown>
      </div>
    </section>
  );
};

export default EventDescription; 