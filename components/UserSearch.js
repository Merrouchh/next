import { useState, useRef, useEffect } from 'react';
import styles from '../styles/UserSearch.module.css';
import { AiOutlineSearch, AiOutlineUser } from 'react-icons/ai';
import { createClient } from '../utils/supabase/component';
import { useRouter } from 'next/router';

const UserSearch = ({ className }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchRef = useRef(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .ilike('username', `%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserClick = (selectedUsername) => {
    // Clear search results and query
    setSearchResults([]);
    setSearchQuery('');
    setShowResults(false);
    
    // Use Next.js router for navigation
    router.push(`/profile/${selectedUsername}`);
  };

  const handleInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowResults(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(query);
      }, 300);
    } else {
      setSearchResults([]);
    }
  };

  return (
    <nav className={`${styles.searchNav} ${className || ''}`} role="search" aria-label="User Search">
      <div ref={searchContainerRef} className={styles.searchContainer}>
        <div className={styles.searchInputWrapper}>
          <AiOutlineSearch className={styles.searchIcon} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={() => setShowResults(true)}
            placeholder="Search users..."
            className={styles.searchInput}
            aria-label="Search users"
          />
        </div>
        
        {showResults && (searchResults.length > 0 || isSearching) && (
          <div className={styles.searchResults}>
            {isSearching ? (
              <div className={styles.searchingMessage}>
                Searching for users...
              </div>
            ) : (
              searchResults.map((user) => (
                <button
                  key={user.username}
                  className={styles.searchResultItem}
                  onClick={() => handleUserClick(user.username)}
                  type="button"
                  role="link"
                >
                  <AiOutlineUser className={styles.userIcon} />
                  <span>{user.username}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default UserSearch; 