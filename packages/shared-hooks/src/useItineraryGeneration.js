// hooks/useItineraryGeneration.js - Quick Itinerary generation (React Native).
// Wired to the real itineraryAPI in shared-services; share/clipboard use the
// native APIs instead of web-only window/navigator.
import { useState, useCallback, useRef } from 'react';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { itineraryAPI } from '@prayana/shared-services';

export const useItineraryGeneration = () => {
  const [markdownData, setMarkdownData] = useState(null);
  const [structuredData, setStructuredData] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    markdown: false,
    structured: false
  });
  const [errors, setErrors] = useState({});

  // Use refs to prevent stale closures
  const abortControllers = useRef({});

  const setLoading = useCallback((type, loading) => {
    setLoadingStates(prev => ({ ...prev, [type]: loading }));
  }, []);

  const setError = useCallback((type, error) => {
    setErrors(prev => ({ ...prev, [type]: error }));
  }, []);

  const clearError = useCallback((type) => {
    setErrors(prev => ({ ...prev, [type]: null }));
  }, []);

  const abortRequest = useCallback((type) => {
    if (abortControllers.current[type]) {
      abortControllers.current[type].abort();
      delete abortControllers.current[type];
    }
  }, []);

  // Method to set initial markdown data without API call
  const setInitialMarkdownData = useCallback((data) => {
    console.log('Setting initial markdown data in hook');
    setMarkdownData(data);
  }, []);

  // Method to set initial structured data without API call
  const setInitialStructuredData = useCallback((data) => {
    console.log('Setting initial structured data in hook');
    setStructuredData(data);
  }, []);

  const generateMarkdown = useCallback(async (requestData) => {
    // Abort any existing request
    abortRequest('markdown');

    // Create new abort controller for this request
    abortControllers.current.markdown = new AbortController();

    setLoading('markdown', true);
    clearError('markdown');

    try {
      const result = await itineraryAPI.generateMarkdown(requestData);
      console.log('Markdown generation completed:', result);
      setMarkdownData(result);
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Markdown generation failed:', error);
        setError('markdown', error.message);
      }
      throw error;
    } finally {
      setLoading('markdown', false);
      delete abortControllers.current.markdown;
    }
  }, [setLoading, clearError, setError, abortRequest]);

  const generateStructured = useCallback(async (requestData) => {
    // Abort any existing request
    abortRequest('structured');

    // Create new abort controller for this request
    abortControllers.current.structured = new AbortController();

    setLoading('structured', true);
    clearError('structured');

    try {
      const result = await itineraryAPI.generateStructured(requestData);
      console.log('Structured generation completed:', result);
      setStructuredData(result);
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Structured generation failed:', error);
        setError('structured', error.message);
      }
      throw error;
    } finally {
      setLoading('structured', false);
      delete abortControllers.current.structured;
    }
  }, [setLoading, clearError, setError, abortRequest]);

  const retry = useCallback(async (type, requestData) => {
    if (type === 'markdown') {
      return generateMarkdown(requestData);
    } else if (type === 'structured') {
      return generateStructured(requestData);
    }
  }, [generateMarkdown, generateStructured]);

  const reset = useCallback(() => {
    // Abort all requests
    Object.keys(abortControllers.current).forEach(type => {
      abortRequest(type);
    });

    setMarkdownData(null);
    setStructuredData(null);
    setLoadingStates({ markdown: false, structured: false });
    setErrors({});
  }, [abortRequest]);

  return {
    markdownData,
    structuredData,
    loadingStates,
    errors,
    generateMarkdown,
    generateStructured,
    setInitialMarkdownData,
    setInitialStructuredData,
    retry,
    reset,
    isLoading: loadingStates.markdown || loadingStates.structured
  };
};

export const useItineraryActions = () => {
  const [bookmarkStates, setBookmarkStates] = useState({});
  const [shareStates, setShareStates] = useState({});

  const toggleBookmark = useCallback(async (itineraryId, isCurrentlyBookmarked = false) => {
    // Bookmarking is handled via favoritesAPI at the screen level; this just
    // tracks optimistic UI state for the button.
    setBookmarkStates(prev => ({
      ...prev,
      [itineraryId]: isCurrentlyBookmarked ? 'removed' : 'added'
    }));
    return !isCurrentlyBookmarked;
  }, []);

  // Public deep-link base for sharing itineraries.
  const SHARE_BASE_URL = 'https://prayanaai.com';

  const shareItinerary = useCallback(async (itinerary) => {
    const shareId = itinerary.itineraryId || itinerary.markdownItineraryId || itinerary._id;
    setShareStates(prev => ({ ...prev, [shareId]: 'loading' }));

    try {
      const title =
        itinerary.title || `${itinerary.duration}-Day ${itinerary.destination} Trip`;
      const url = `${SHARE_BASE_URL}/itinerary/${shareId}`;
      const message =
        (itinerary.subtitle ||
          `Check out this ${itinerary.duration}-day trip to ${itinerary.destination}!`) +
        `\n\n${url}`;

      // React Native's native share sheet.
      await Share.share({ title, message });
      setShareStates(prev => ({ ...prev, [shareId]: 'shared' }));

      setTimeout(() => {
        setShareStates(prev => ({ ...prev, [shareId]: null }));
      }, 3000);
    } catch (error) {
      console.error('Share failed:', error);
      setShareStates(prev => ({ ...prev, [shareId]: 'error' }));
      setTimeout(() => {
        setShareStates(prev => ({ ...prev, [shareId]: null }));
      }, 3000);
    }
  }, []);

  const copyMarkdown = useCallback(async (markdown) => {
    try {
      await Clipboard.setStringAsync(markdown ?? '');
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }, []);

  return {
    bookmarkStates,
    shareStates,
    toggleBookmark,
    shareItinerary,
    copyMarkdown
  };
};

export const useTabSystem = (initialTab = 'markdown', onTabChange) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [transitionState, setTransitionState] = useState('idle');

  const changeTab = useCallback(async (newTab) => {
    if (newTab === activeTab) return;

    setTransitionState('changing');

    // Call external handler if provided
    if (onTabChange) {
      await onTabChange(newTab, activeTab);
    }

    setActiveTab(newTab);

    // Small delay for smooth transition
    setTimeout(() => {
      setTransitionState('idle');
    }, 150);
  }, [activeTab, onTabChange]);

  return {
    activeTab,
    transitionState,
    changeTab,
    isTransitioning: transitionState === 'changing'
  };
};
