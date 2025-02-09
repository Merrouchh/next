import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../utils/supabase/component';
import styles from '../styles/UserSearch.module.css';
import { AiOutlineSearch, AiOutlineUser } from 'react-icons/ai';

const UserSearch = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchRef = useRef(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (query) => {
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
  }, [supabase]);

  const handleUserClick = async (selectedUsername) => {
    // Clear search results and query
    setSearchResults([]);
    setSearchQuery('');
    setShowResults(false);
    
    // Navigate to the user's profile
    // Use replace instead of push to avoid adding to history
    // and shallow: false to ensure full data refresh
    await router.replace(`/profile/${selectedUsername}`, undefined, { 
      shallow: false 
    });
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
    <div className={styles.searchContainer} ref={searchRef}>
      <div className={styles.searchInputWrapper}>
        <AiOutlineSearch className={styles.searchIcon} />
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => setShowResults(true)}
          placeholder="Search users..."
          className={styles.searchInput}
        />
      </div>
      
      {showResults && (searchResults.length > 0 || isSearching) && (
        <div className={styles.searchResults}>
          {isSearching ? (
            <div className={styles.searchingMessage}>
              Searching...
            </div>
          ) : (
            searchResults.map((user) => (
              <div
                key={user.username}
                className={styles.searchResultItem}
                onClick={() => handleUserClick(user.username)}
              >
                <AiOutlineUser className={styles.userIcon} />
                <span>{user.username}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearch; 