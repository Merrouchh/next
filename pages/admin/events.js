import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { toast } from 'react-hot-toast';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaImage, FaUsers } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import ProtectedPageWrapper from '../../components/ProtectedPageWrapper';
import styles from '../../styles/AdminEvents.module.css';

export default function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    game: '',
    status: 'Upcoming',
    image: null,
    registration_limit: '',
    team_type: 'solo'
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();
  const { user, supabase } = useAuth();

  // Redirect if not logged in or not admin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!user) {
        router.replace('/');
      } else if (!user.isAdmin) {
        router.replace('/dashboard');
        toast.error('You do not have permission to access this page');
      }
    }
  }, [user, router]);

  // Fetch events from API
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      
      try {
        // Get the session for authentication
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        
        const response = await fetch('/api/events', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        
        const data = await response.json();
        setEvents(data);
        
        // Check if there's an edit parameter in the URL
        if (router.query.edit) {
          const eventId = parseInt(router.query.edit);
          const eventToEdit = data.find(event => event.id === eventId);
          if (eventToEdit) {
            handleEditEvent(eventToEdit);
          } else {
            toast.error('Event not found');
          }
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events');
        
        // Fallback to sample data for development
        const sampleEvents = [
          {
            id: 1,
            title: 'Gaming Tournament',
            description: 'Join our monthly gaming tournament and compete for prizes!',
            date: '2025-04-15',
            time: '18:00',
            location: 'Online',
            game: 'Fortnite, League of Legends, CS:GO',
            status: 'Upcoming',
            image: 'https://qdbtccrhcidxllycuxnw.supabase.co/storage/v1/object/public/images/event1.jpg'
          },
          {
            id: 2,
            title: 'Game Developer Meetup',
            description: 'Connect with other game developers and share your projects.',
            date: '2025-04-22',
            time: '19:30',
            location: 'Tech Hub, Downtown',
            game: 'Game Development',
            status: 'In Progress',
            image: 'https://qdbtccrhcidxllycuxnw.supabase.co/storage/v1/object/public/images/event2.jpg'
          },
          {
            id: 3,
            title: 'Esports Watch Party',
            description: 'Watch the championship finals with fellow gaming enthusiasts!',
            date: '2025-05-01',
            time: '20:00',
            location: 'Gaming Lounge',
            game: 'League of Legends World Championship',
            status: 'Completed',
            image: 'https://qdbtccrhcidxllycuxnw.supabase.co/storage/v1/object/public/images/event3.jpg'
          }
        ];
        
        setEvents(sampleEvents);
        
        // Check if there's an edit parameter in the URL (for sample data)
        if (router.query.edit) {
          const eventId = parseInt(router.query.edit);
          const eventToEdit = sampleEvents.find(event => event.id === eventId);
          if (eventToEdit) {
            handleEditEvent(eventToEdit);
          } else {
            toast.error('Event not found');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    if (user && user.isAdmin) {
      fetchEvents();
    }
  }, [user, supabase, router.query.edit]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: null
      });
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setFormErrors({
          ...formErrors,
          image: 'Image size should be less than 5MB'
        });
        return;
      }
      
      setFormData({
        ...formData,
        image: file
      });
      
      // Clear error for image
      if (formErrors.image) {
        setFormErrors({
          ...formErrors,
          image: null
        });
      }
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.time) errors.time = 'Time is required';
    if (!formData.location.trim()) errors.location = 'Location is required';
    if (!formData.game.trim()) errors.game = 'Game is required';
    if (!formData.status) errors.status = 'Status is required';
    if (!formData.team_type) errors.team_type = 'Team type is required';
    
    // Validate registration limit if provided
    if (formData.registration_limit) {
      const limit = parseInt(formData.registration_limit);
      if (isNaN(limit) || limit <= 0) {
        errors.registration_limit = 'Registration limit must be a positive number';
      } else {
        // Check if the limit is a power of 2 (8, 16, 32, 64)
        const isPowerOfTwo = (limit & (limit - 1)) === 0;
        const isInRange = limit >= 8 && limit <= 64;
        if (!isPowerOfTwo || !isInRange) {
          errors.registration_limit = 'Registration limit must be a power of 2 (8, 16, 32, or 64)';
        }
      }
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Open modal for creating a new event
  const handleCreateEvent = () => {
    setCurrentEvent(null);
    setFormData({
      title: '',
      description: '',
      date: '',
      time: '',
      location: '',
      game: '',
      status: 'Upcoming',
      image: null,
      registration_limit: '',
      team_type: 'solo'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open modal for editing an existing event
  const handleEditEvent = (event) => {
    setCurrentEvent(event);
    setFormData({
      title: event.title || '',
      description: event.description || '',
      date: event.date || '',
      time: event.time || '',
      location: event.location || '',
      game: event.game || '',
      status: event.status || 'Upcoming',
      image: null,
      registration_limit: event.registration_limit || '',
      team_type: event.team_type || 'solo'
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Upload image to server
  const uploadImage = async (eventId) => {
    if (!formData.image) return null;
    
    setIsUploading(true);
    
    try {
      // Get the session for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) {
        throw new Error('No authentication token available. Please log in again.');
      }
      
      console.log(`Preparing to upload image for event ID: ${eventId}`);
      
      const formDataObj = new FormData();
      formDataObj.append('image', formData.image);
      formDataObj.append('eventId', eventId);
      
      console.log('Sending image upload request...');
      const response = await fetch('/api/events/upload-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formDataObj
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Upload response error:', responseData);
        throw new Error(responseData.details || responseData.error || 'Failed to upload image');
      }
      
      console.log('Image uploaded successfully:', responseData.imageUrl);
      return responseData.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(`Failed to upload image: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    
    try {
      // Validate form data
      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
      
      // Prepare event data
      const eventData = {
        title: formData.title,
        description: formData.description,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        game: formData.game,
        status: formData.status,
        registration_limit: formData.registration_limit,
        team_type: formData.team_type
      };
      
      let response;
      let newEvent;
      
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (currentEvent) {
        // Update existing event
        response = await fetch(`/api/events/${currentEvent.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
          throw new Error('Failed to update event');
        }
        
        newEvent = await response.json();
        
        // Upload image if provided
        if (formData.image) {
          const imageUrl = await uploadImage(newEvent.id);
          if (imageUrl) {
            newEvent.image = imageUrl;
          }
        }
        
        // Update local state
        setEvents(events.map(event => 
          event.id === newEvent.id ? newEvent : event
        ));
        
        toast.success('Event updated successfully!');
      } else {
        // Create new event
        response = await fetch('/api/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
          throw new Error('Failed to create event');
        }
        
        newEvent = await response.json();
        
        // Upload image if provided
        if (formData.image) {
          const imageUrl = await uploadImage(newEvent.id);
          if (imageUrl) {
            newEvent.image = imageUrl;
          }
        }
        
        // Update local state
        setEvents([...events, newEvent]);
        
        toast.success('Event created successfully!');
      }
      
      // Close modal and reset form
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        game: '',
        status: 'Upcoming',
        image: null,
        registration_limit: '',
        team_type: 'solo'
      });
      setCurrentEvent(null);
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle event deletion
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
      setLoading(true);
      
      // Get the session for authentication
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete event');
      }
      
      // Update local state
      setEvents(events.filter(event => event.id !== eventId));
      toast.success('Event deleted successfully!');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Filter events by status
  const filteredEvents = statusFilter === 'All' 
    ? events 
    : events.filter(event => event.status === statusFilter);

  // If not authenticated or not admin, don't render anything
  if (!user || !user.isAdmin) {
    return null;
  }

  return (
    <ProtectedPageWrapper>
      <Head>
        <title>Manage Events | Admin Dashboard</title>
        <meta name="description" content="Admin dashboard for managing gaming events" />
      </Head>

      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>
            <FaCalendarAlt className={styles.titleIcon} />
            Manage Events
          </h1>
          <button 
            className={styles.createButton}
            onClick={handleCreateEvent}
          >
            <FaPlus /> Create New Event
          </button>
        </div>

        <div className={styles.filterContainer}>
          <div className={styles.filterLabel}>Filter by status:</div>
          <div className={styles.filterButtons}>
            <button 
              className={`${styles.filterButton} ${statusFilter === 'All' ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter('All')}
            >
              All Events
            </button>
            <button 
              className={`${styles.filterButton} ${statusFilter === 'Upcoming' ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter('Upcoming')}
            >
              Upcoming
            </button>
            <button 
              className={`${styles.filterButton} ${statusFilter === 'In Progress' ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter('In Progress')}
            >
              In Progress
            </button>
            <button 
              className={`${styles.filterButton} ${statusFilter === 'Completed' ? styles.filterActive : ''}`}
              onClick={() => setStatusFilter('Completed')}
            >
              Completed
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loader}></div>
              <p>Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className={styles.emptyState}>
              <FaCalendarAlt className={styles.emptyIcon} />
              <h2>No {statusFilter !== 'All' ? statusFilter : ''} Events Found</h2>
              <p>{statusFilter !== 'All' ? `There are no ${statusFilter.toLowerCase()} events.` : 'Create your first event to get started!'}</p>
              <button 
                className={styles.createButton}
                onClick={handleCreateEvent}
              >
                <FaPlus /> Create New Event
              </button>
            </div>
          ) : (
            <div className={styles.eventsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCell}>Event</div>
                <div className={styles.tableCell}>Date & Time</div>
                <div className={styles.tableCell}>Location</div>
                <div className={styles.tableCell}>Game</div>
                <div className={styles.tableCell}>Status</div>
                <div className={styles.tableCell}>Actions</div>
              </div>
              
              {filteredEvents.map((event) => (
                <div key={event.id} className={styles.tableRow}>
                  <div className={styles.tableCell} data-label="Event">
                    <div className={styles.eventInfo}>
                      <div className={styles.eventTitle}>{event.title}</div>
                      <div className={styles.eventDescription}>
                        {event.description.length > 60 
                          ? `${event.description.substring(0, 60)}...` 
                          : event.description}
                      </div>
                    </div>
                  </div>
                  <div className={styles.tableCell} data-label="Date & Time">
                    <div className={styles.eventDate}>
                      {formatDate(event.date)}
                    </div>
                    <div className={styles.eventTime}>{event.time}</div>
                  </div>
                  <div className={styles.tableCell} data-label="Location">
                    <div className={styles.eventLocation}>{event.location}</div>
                  </div>
                  <div className={styles.tableCell} data-label="Game">
                    <div className={styles.eventGame}>{event.game || 'Various Games'}</div>
                  </div>
                  <div className={styles.tableCell} data-label="Status">
                    <div className={`${styles.eventStatus} ${styles[`status${event.status?.replace(/\s+/g, '')}`]}`}>
                      {event.status || 'Upcoming'}
                    </div>
                  </div>
                  <div className={styles.tableCell} data-label="Actions">
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.editButton}
                        onClick={() => handleEditEvent(event)}
                      >
                        <FaEdit /> Edit
                      </button>
                      <button 
                        className={styles.deleteButton}
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <FaTrash /> Delete
                      </button>
                      <button 
                        className={styles.viewButton}
                        onClick={() => router.push(`/admin/events/registrations/${event.id}`)}
                      >
                        <FaUsers /> Registrations
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Form Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>{currentEvent ? 'Edit Event' : 'Create New Event'}</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setIsModalOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.eventForm}>
              <div className={styles.formGroup}>
                <label htmlFor="title">Event Title</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter event title"
                  className={formErrors.title ? styles.inputError : ''}
                />
                {formErrors.title && <div className={styles.errorMessage}>{formErrors.title}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter event description"
                  rows="4"
                  className={formErrors.description ? styles.inputError : ''}
                ></textarea>
                {formErrors.description && <div className={styles.errorMessage}>{formErrors.description}</div>}
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="date">Date</label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={formErrors.date ? styles.inputError : ''}
                  />
                  {formErrors.date && <div className={styles.errorMessage}>{formErrors.date}</div>}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="time">Time</label>
                  <input
                    type="time"
                    id="time"
                    name="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    className={formErrors.time ? styles.inputError : ''}
                  />
                  {formErrors.time && <div className={styles.errorMessage}>{formErrors.time}</div>}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Enter event location"
                  className={formErrors.location ? styles.inputError : ''}
                />
                {formErrors.location && <div className={styles.errorMessage}>{formErrors.location}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="game">Game</label>
                <input
                  type="text"
                  id="game"
                  name="game"
                  value={formData.game}
                  onChange={handleInputChange}
                  placeholder="Enter event game"
                  className={formErrors.game ? styles.inputError : ''}
                />
                {formErrors.game && <div className={styles.errorMessage}>{formErrors.game}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="status">Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className={formErrors.status ? styles.inputError : ''}
                >
                  <option value="Upcoming">Upcoming</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                {formErrors.status && <div className={styles.errorMessage}>{formErrors.status}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="team_type">Team Type</label>
                <select
                  id="team_type"
                  name="team_type"
                  value={formData.team_type}
                  onChange={handleInputChange}
                  className={formErrors.team_type ? styles.inputError : ''}
                >
                  <option value="solo">Solo (Individual)</option>
                  <option value="duo">Duo (2 Players)</option>
                  <option value="team">Team (Multiple Players)</option>
                </select>
                {formErrors.team_type && <div className={styles.errorMessage}>{formErrors.team_type}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="registration_limit">Registration Limit (Powers of 2 only)</label>
                <select
                  id="registration_limit"
                  name="registration_limit"
                  value={formData.registration_limit}
                  onChange={handleInputChange}
                  className={formErrors.registration_limit ? styles.inputError : ''}
                >
                  <option value="">Select a limit</option>
                  <option value="8">8 participants</option>
                  <option value="16">16 participants</option>
                  <option value="32">32 participants</option>
                  <option value="64">64 participants</option>
                </select>
                <div className={styles.fieldNote}>
                  <strong>Important:</strong> For optimal tournament brackets, registration limits must be powers of 2 (minimum 8 participants)
                </div>
                {formErrors.registration_limit && <div className={styles.errorMessage}>{formErrors.registration_limit}</div>}
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="image">
                  Event Image {currentEvent && <span className={styles.optionalLabel}>(Optional)</span>}
                </label>
                <div className={styles.imageUploadContainer}>
                  <input
                    type="file"
                    id="image"
                    name="image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.fileInput}
                  />
                  <label htmlFor="image" className={styles.fileInputLabel}>
                    <FaImage className={styles.uploadIcon} />
                    {formData.image ? formData.image.name : 'Choose an image'}
                  </label>
                </div>
                {formErrors.image && <div className={styles.errorMessage}>{formErrors.image}</div>}
                <div className={styles.imageNote}>
                  {currentEvent 
                    ? 'Upload a new image to replace the existing one (max 5MB)' 
                    : 'Upload an image for the event (max 5MB)'}
                </div>
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={isSubmitting || isUploading}
                >
                  {isSubmitting || isUploading 
                    ? 'Saving...' 
                    : currentEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedPageWrapper>
  );
} 