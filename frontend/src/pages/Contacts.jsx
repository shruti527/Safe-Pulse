import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket } from '../socket';
import AddContactModal from "../components/AddContactModal";

// ContactCard component displays individual contact details and actions based on status
const ContactCard = ({ contact, onAccept, onReject, onCancel, onTrack }) => {
  const isOnline = contact.status === 'Online' || contact.online;

  return (
    <div className="bg-surface-container-low dark:bg-surface-container/20 rounded-xl p-4 flex items-center justify-between mb-3 border border-surface-container dark:border-white/5">
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center w-12 h-12 bg-primary text-white rounded-full">
          {contact.avatar ? (
            <img src={contact.avatar} alt={contact.name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[24px]">person</span>
          )}
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-surface rounded-full" />
          )}
        </div>
        <div>
          <h3 className="font-label-md text-label-md text-on-surface">{contact.name}</h3>
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            {contact.relation} • {contact.phone}
            {contact.statusLabel && (
              <span className="block text-[11px] text-secondary mt-1">
                {contact.statusLabel}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Action buttons based on contact status */}
        {contact.status === 'pending_received' && (
          <>
            <button onClick={() => onAccept(contact)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm">Accept</button>
            <button onClick={() => onReject(contact)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm">Reject</button>
          </>
        )}
        {contact.status === 'pending_sent' && (
          <button onClick={() => onCancel(contact)} className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm">Cancel</button>
        )}
        {/* Track on Map — only available for fully accepted contacts */}
        {contact.status === 'accepted' && (
          <button 
            onClick={() => onTrack(contact)}
            className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:bg-secondary/10 transition-colors"
            title="Track on Map"
          >
            <span className="material-symbols-outlined text-[18px]">location_on</span>
          </button>
        )}
        <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-dim transition-colors">
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
      </div>
    </div>
  );
};

const Contacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('trackingMe'); // 'trackingMe' shows contacts who can see you, 'iTrack' shows contacts you track
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState('');

  // Fetch contacts from backend
  const fetchContacts = async () => {
    try {
      const { data } = await axios.get('/api/auth/contacts');
      
      const mappedContacts = (data.data || []).map(c => {
        if (!c.user) return null;
        return {
          _id: c._id,
          userId: c.user._id,
          name: c.user.name,
          phone: c.user.phone || '',
          relation: 'Trusted Contact',
          avatar: null, // static icon will be used
          status: c.status,
          statusLabel: c.status === 'accepted'
            ? c.user.status
            : c.status === 'pending_received'
              ? 'Incoming request'
              : c.status === 'pending_sent'
                ? 'Request sent'
                : '',
          trackingMe: c.status === 'accepted' || c.status === 'pending_received',
          iTrack: c.status === 'accepted' || c.status === 'pending_sent'
        };
      }).filter(Boolean);
      
      setContacts(mappedContacts);
    } catch (err) {
      console.error('Failed to load contacts', err);
    }
  };

  useEffect(() => {
    fetchContacts();

    // Listen for real-time contact status updates via singleton Socket.IO
    const socket = getSocket();

    const userId = localStorage.getItem('userId');
    if (userId) {
      socket.emit('join_user_room', userId);
    }

    // New incoming contact request — refresh list
    socket.on('contact_request_received', () => {
      fetchContacts();
    });

    // Accept/reject status update — merge into existing list
    socket.on('contactStatusUpdate', (updatedContact) => {
      // If it has a full user object, merge; otherwise refresh
      if (updatedContact && updatedContact._id) {
        setContacts(prev => {
          const exists = prev.some(c => c._id === updatedContact._id || c.userId === updatedContact.userId);
          if (exists) {
            return prev.map(c => (c._id === updatedContact._id ? { ...c, ...updatedContact } : c));
          }
          // New contact added — re-fetch to get properly populated data
          fetchContacts();
          return prev;
        });
      } else {
        fetchContacts();
      }
    });

    return () => {
      socket.off('contact_request_received');
      socket.off('contactStatusUpdate');
    };
  }, []);


  const handleAddContact = () => {
    setShowAddModal(true);
    setAddError('');
  };

  // Called by both the manual form (once) and the phonebook batch path (once per contact).
  // When `options.silent` is true (phonebook batch), we skip closing the modal and refreshing
  // mid-loop — the modal itself calls onClose after all requests finish, then we refresh once.
  const handleAddSubmit = async (value, options = {}) => {
    const { silent = false } = options;
    try {
      const res = await axios.post('/api/auth/contacts/request', { emailOrPhone: value });
      if (res.data.success) {
        if (!silent) {
          setShowAddModal(false);
          fetchContacts();
        }
      } else {
        if (!silent) {
          setAddError(res.data.message || 'Failed to send request');
        }
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        setAddError(err.response?.data?.message || 'Failed to send request');
      }
    }
  };

  // Called after the phonebook modal closes post-batch to refresh the list once
  const handleModalClose = () => {
    setShowAddModal(false);
    fetchContacts();
  };

  const handleAccept = async (contact) => {
    try {
      await axios.post('/api/auth/contacts/accept', { contactId: contact.userId });
      fetchContacts();
    } catch (err) {
      console.error('Accept failed:', err.response?.data || err);
    }
  };

  const handleReject = async (contact) => {
    try {
      await axios.post('/api/auth/contacts/reject', { contactId: contact.userId });
      fetchContacts();
    } catch (err) {
      console.error('Reject failed:', err.response?.data || err);
    }
  };

  const handleCancelRequest = async (contact) => {
    // Cancel a pending_sent request by rejecting it (removes from both sides)
    try {
      await axios.post('/api/auth/contacts/reject', { contactId: contact.userId });
      fetchContacts();
    } catch (err) {
      console.error('Cancel request failed:', err.response?.data || err);
    }
  };

  const handleTrackContact = (contact) => {
    navigate(`/?track=${contact.userId}`);
  };

  const filteredContacts = contacts.filter(c => {
    const matchesTab = activeTab === 'trackingMe' ? c.trackingMe : c.iTrack;
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone?.includes(searchTerm);
    return matchesTab && matchesSearch;
  });

  return (
    <div className="flex-grow flex flex-col h-[calc(100vh-130px)] px-container-margin pt-20 pb-24 overflow-y-auto bg-surface dark:bg-safepulse-dark">
      <div className="flex justify-between items-center mb-6 relative z-40">
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Trusted Contacts</h2>
        <button 
          onClick={handleAddContact}
          className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-2 px-6 rounded-full flex items-center gap-2 shadow-lg hover:shadow-xl transition-all duration-200 whitespace-nowrap flex-shrink-0"
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff'
          }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontSize: '18px' }}>person_add</span>
          <span className="font-label-md text-label-md">Add</span>
        </button>
      </div>

      {/* Tab selector */}
      <div className="flex bg-surface-container-low dark:bg-surface-container rounded-lg p-1 mb-6">
        <button
          onClick={() => setActiveTab('trackingMe')}
          className={`flex-1 py-2 font-label-sm text-label-sm rounded-md transition-all ${activeTab === 'trackingMe' ? 'bg-surface dark:bg-surface-container-high shadow-sm text-primary dark:text-on-primary' : 'text-on-surface-variant'}`}
        >
          Tracking Me
        </button>
        <button
          onClick={() => setActiveTab('iTrack')}
          className={`flex-1 py-2 font-label-sm text-label-sm rounded-md transition-all ${activeTab === 'iTrack' ? 'bg-surface dark:bg-surface-container-high shadow-sm text-primary dark:text-on-primary' : 'text-on-surface-variant'}`}
        >
          I Track
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-surface-container-low dark:bg-surface-container/30 border border-transparent focus:border-secondary dark:focus:border-safepulse-accent rounded-xl py-3 pl-10 pr-4 font-body-md text-on-surface outline-none transition-all"
        />
      </div>

      {/* Contact list */}
      <div className="flex-grow">
        <h3 className="font-label-sm text-label-sm text-on-surface-variant mb-3 sticky top-0 bg-surface dark:bg-safepulse-dark py-2 z-10">
          {activeTab === 'trackingMe'
            ? 'Can see your location / Incoming requests'
            : 'You can see their location / Outgoing requests'} ({filteredContacts.length})
        </h3>
        {filteredContacts.map(contact => (
          <ContactCard
            key={contact._id}
            contact={contact}
            onAccept={handleAccept}
            onReject={handleReject}
            onCancel={handleCancelRequest}
            onTrack={handleTrackContact}
          />
        ))}
        {filteredContacts.length === 0 && (
          <div className="text-center py-10">
            <div className="w-16 h-16 rounded-full bg-surface-container mx-auto flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-on-surface-variant text-[32px]">group_off</span>
            </div>
            <p className="font-body-md text-on-surface-variant">No contacts found in this section.</p>
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <AddContactModal
          onClose={handleModalClose}
          onSubmit={handleAddSubmit}
          errorMessage={addError}
        />
      )}
    </div>
  );
};

export default Contacts;
