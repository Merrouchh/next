import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '../utils/supabase/component';
import styles from '../styles/DashboardSearch.module.css';
import { MdSearch } from 'react-icons/md';
import { FaGamepad } from 'react-icons/fa';
import debounce from 'lodash/debounce';

const DashboardUserSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const router = useRouter();

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const debouncedSearch = useCallback(
    debounce(async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const supabase = createClient();

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
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    []
  );

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchValue(query);
    debouncedSearch(query);
    setShowResults(true);
  };

  const handleUserClick = (username) => {
    router.push(`/profile/${username}`);
    setShowResults(false);
    setSearchValue('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      debouncedSearch(searchValue);
      setShowResults(true);
    }
  };

  return (
    <div className={styles.dashboardSearchContainer} ref={searchRef}>
      <form onSubmit={handleSubmit} className={styles.searchInputWrapper}>
        <MdSearch className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search gamers..."
          value={searchValue}
          onChange={handleSearch}
          className={styles.searchInput}
        />
        <button type="submit" className={styles.searchButton}>
          <MdSearch />
        </button>
      </form>

      {showResults && (searchResults.length > 0 || isSearching) && (
        <div className={styles.dashboardSearchResults}>
          {isSearching ? (
            <div className={styles.searchLoading}>
              <div className={styles.searchSpinner} />
              Searching for gamers...
            </div>
          ) : (
            searchResults.map((user) => (
              <button
                key={user.username}
                className={styles.searchResultItem}
                onClick={() => handleUserClick(user.username)}
              >
                <FaGamepad className={styles.userIcon} />
                <span>{user.username}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardUserSearch; 