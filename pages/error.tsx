import Link from 'next/link'
import styles from '../styles/Error.module.css'

export default function ErrorPage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Oops! Something went wrong</h1>
        <p className={styles.message}>
          We encountered an error while processing your request.
        </p>
        <div className={styles.actions}>
          <Link 
            href="/" 
            className={styles.button}
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  )
} 