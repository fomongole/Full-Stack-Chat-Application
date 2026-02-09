import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types';

/**
 * User search functionality.
 * Handles search state and API calls.
 */
export const useUserSearch = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    /**
     * Perform user search
     */
    const handleSearch = useCallback(async (query: string) => {
        setSearchQuery(query);

        // Clear results if query is empty
        if (!query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
            setSearchResults(response.data.data.users);
        } catch (error) {
            console.error('Search failed:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    /**
     * Clear search
     */
    const clearSearch = useCallback(() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsSearching(false);
    }, []);

    return {
        searchQuery,
        searchResults,
        isSearching,
        handleSearch,
        clearSearch,
    };
};