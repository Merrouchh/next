import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../utils/supabase/component';
import styles from '../styles/UserSearch.module.css';
import { AiOutlineSearch, AiOutlineUser } from 'react-icons/ai';

const supabase = createClient();

const UserSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchUsers = async (query) => {
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
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    setShowResults(true);
    
    let mounted = true;
    const timeoutId = setTimeout(async () => {
      if (!mounted) return;
      await searchUsers(query);
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  };

  const handleSelectUser = (username) => {
    router.push(`/profile/${username}`);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <div className={styles.searchContainer} ref={searchRef}>
      <div className={styles.searchInputWrapper}>
        <AiOutlineSearch className={styles.searchIcon} />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search users..."
          className={styles.searchInput}
          onFocus={() => setShowResults(true)}
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
                onClick={() => handleSelectUser(user.username)}
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