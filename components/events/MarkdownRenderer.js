import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import styles from '../../styles/EventDetail.module.css';

const MarkdownRenderer = ({ event }) => {
  return (
    <div className={styles.eventDescription}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom link component that opens external links in new tab
          a: ({ ...props }) => {
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
          h1: ({ ...props }) => <h1 className={styles.markdownH1} {...props} />,
          h2: ({ ...props }) => <h2 className={styles.markdownH2} {...props} />,
          h3: ({ ...props }) => <h3 className={styles.markdownH3} {...props} />,
          // Custom list components
          ul: ({ ...props }) => <ul className={styles.markdownList} {...props} />,
          ol: ({ ...props }) => <ol className={styles.markdownList} {...props} />,
          // Custom code components
          code: ({ inline, ...props }) => (
            inline ? 
              <code className={styles.markdownInlineCode} {...props} /> :
              <code className={styles.markdownCode} {...props} />
          ),
          // Custom blockquote
          blockquote: ({ ...props }) => <blockquote className={styles.markdownBlockquote} {...props} />,
          // Custom table components
          table: ({ ...props }) => <table className={styles.markdownTable} {...props} />,
          th: ({ ...props }) => <th className={styles.markdownTh} {...props} />,
          td: ({ ...props }) => <td className={styles.markdownTd} {...props} />,
        }}
      >
        {event.description}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 