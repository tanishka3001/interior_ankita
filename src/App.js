import { useEffect, useRef, useState } from 'react';
import './App.css';

const ADMIN_PATH = '/studio-admin';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';
const ADMIN_SESSION_KEY = 'interior-ankita-admin-session';
const ADMIN_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

const apiUrl = (path) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
};

const readJsonResponse = async (response, fallbackMessage) => {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text();
    if (text.includes('<!DOCTYPE')) {
      throw new Error(
        fallbackMessage ||
          'The server returned HTML instead of JSON. If you are running locally, use Vercel deployment or set REACT_APP_API_BASE_URL to a backend that serves /api routes.'
      );
    }

    throw new Error(fallbackMessage || 'Unexpected response from the server.');
  }

  return response.json();
};

const readStoredAdminToken = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const rawSession = window.localStorage.getItem(ADMIN_SESSION_KEY);

    if (!rawSession) {
      return '';
    }

    const parsedSession = JSON.parse(rawSession);
    if (!parsedSession?.token || !parsedSession?.savedAt) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return '';
    }

    if (Date.now() - parsedSession.savedAt > ADMIN_SESSION_MAX_AGE_MS) {
      window.localStorage.removeItem(ADMIN_SESSION_KEY);
      return '';
    }

    return String(parsedSession.token).trim();
  } catch (error) {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
    return '';
  }
};

const saveAdminToken = (token) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    ADMIN_SESSION_KEY,
    JSON.stringify({
      token,
      savedAt: Date.now(),
    })
  );
};

const clearAdminToken = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_KEY);
};

const defaultProjects = [
  {
    name: 'The Olive Loft',
    scope: 'Commercials & Residentials',
    note: 'A warm home interior with soft finishes and balanced light.',
    imageUrl: '',
  },
  {
    name: 'Harbor House',
    scope: 'Commercials & Residentials',
    note: 'A professional workspace with simple lines and a calm tone.',
    imageUrl: '',
  },
  {
    name: 'The Atelier Suite',
    scope: 'Commercials & Residentials',
    note: 'A refined commercial setting with elegant finishes and a modern flow.',
    imageUrl: '',
  },
];

const consultationSteps = [
  'Share your space, goals, and timeline',
  'I review the requirements and respond',
  'We arrange a consultation or site visit',
];

function App() {
  const [page, setPage] = useState('home');
  const [formStatus, setFormStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendProjects, setBackendProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const adminTokenRef = useRef(null);
  const [adminAuthToken, setAdminAuthToken] = useState('');
  const [adminVerified, setAdminVerified] = useState(false);
  const [adminStatus, setAdminStatus] = useState('Enter your admin token to verify access.');
  const [adminMessages, setAdminMessages] = useState([]);
  const [projectStatus, setProjectStatus] = useState('Use the admin side to add project images and details.');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRestoringAdminSession, setIsRestoringAdminSession] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setIsLoadingProjects(true);

        const response = await fetch(apiUrl('/api/projects'));
        const data = await readJsonResponse(response, 'Unable to load projects.');

        if (!response.ok) {
          throw new Error(data.error || 'Unable to load projects.');
        }

        setBackendProjects(Array.isArray(data.projects) ? data.projects : []);
      } catch (error) {
        setBackendProjects([]);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    if (window.location.pathname === ADMIN_PATH) {
      setPage('admin');
    }
  }, []);

  useEffect(() => {
    if (page !== 'admin' || adminVerified || isRestoringAdminSession) {
      return;
    }

    const storedToken = readStoredAdminToken();

    if (!storedToken) {
      return;
    }

    if (adminTokenRef.current) {
      adminTokenRef.current.value = storedToken;
    }

    const restoreSession = async () => {
      setIsRestoringAdminSession(true);

      try {
        await handleAdminVerifyToken(storedToken, { rememberSession: true, restoringSession: true });
      } finally {
        setIsRestoringAdminSession(false);
      }
    };

    restoreSession();
  }, [page, adminVerified, isRestoringAdminSession]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    const endpoint = process.env.REACT_APP_CONTACT_API_URL || '/api/contact';

    try {
      setIsSubmitting(true);
      setFormStatus('Sending your message...');

      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse(response, 'Unable to send message.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to send message.');
      }

      form.reset();
      setFormStatus('Message sent. Your backend can save it now.');
    } catch (error) {
      setFormStatus(error.message || 'Message could not be sent right now. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadAdminMessages = async (token) => {
    try {
      setIsLoadingMessages(true);
      setAdminStatus('Loading enquiries...');

      const response = await fetch(apiUrl('/api/admin/messages'), {
        headers: {
          'x-admin-token': token,
        },
      });

      const data = await readJsonResponse(response, 'Unable to load messages.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load messages.');
      }

      setAdminMessages(Array.isArray(data.messages) ? data.messages : []);
      setAdminStatus(data.messages?.length ? 'Messages loaded.' : 'No enquiries yet.');
    } catch (error) {
      setAdminMessages([]);
      setAdminStatus(error.message || 'Could not load enquiries.');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleAdminVerifyToken = async (token, options = {}) => {
    const { rememberSession = true, restoringSession = false } = options;

    try {
      setAdminStatus(restoringSession ? 'Restoring admin session...' : 'Verifying token...');

      const response = await fetch(apiUrl('/api/admin/verify'), {
        headers: {
          'x-admin-token': token,
        },
      });

      const data = await readJsonResponse(response, 'Unable to verify token.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to verify token.');
      }

      setAdminAuthToken(token);
      setAdminVerified(true);
      setAdminStatus('Admin verified. You can now load messages and manage projects.');

      if (rememberSession) {
        saveAdminToken(token);
      }

      await loadAdminMessages(token);
      return true;
    } catch (error) {
      clearAdminToken();
      setAdminAuthToken('');
      setAdminVerified(false);
      setAdminMessages([]);
      setProjectStatus('');
      setAdminStatus(error.message || 'Could not verify the token.');
      return false;
    }
  };

  const handleAdminLoad = async (event) => {
    event.preventDefault();

    if (!adminVerified || !adminAuthToken.trim()) {
      setAdminStatus('Verify the admin token first.');
      return;
    }

    await loadAdminMessages(adminAuthToken.trim());
  };

  const handleAdminVerify = async (event) => {
    event.preventDefault();

    const token = adminTokenRef.current?.value?.trim() || '';

    if (!token) {
      setAdminStatus('Enter the admin token first.');
      return;
    }

    await handleAdminVerifyToken(token, { rememberSession: true });
  };

  const handleProjectSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    const formData = new FormData(form);
    const projectForm = Object.fromEntries(formData.entries());

    if (!adminVerified || !adminAuthToken.trim()) {
      setProjectStatus('Verify the admin token before saving projects.');
      return;
    }

    try {
      setIsSavingProject(true);
      setProjectStatus('Saving project...');

      const response = await fetch(apiUrl('/api/admin/projects'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminAuthToken.trim(),
        },
        body: JSON.stringify(projectForm),
      });

      const data = await readJsonResponse(response, 'Unable to save project.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save project.');
      }

      setBackendProjects((currentProjects) => [data.project, ...currentProjects]);
      form.reset();
      setProjectStatus('Project saved and published to the homepage.');
      window.alert('Project saved successfully.');
    } catch (error) {
      const message = error.message || 'Could not save project.';
      setProjectStatus(message);
      window.alert(`Project save failed: ${message}`);
    } finally {
      setIsSavingProject(false);
    }
  };

  const formatProjectField = (value, fallback) => {
    const text = String(value || '').trim();
    return text || fallback;
  };

  const handleProjectDelete = async (projectId) => {
    if (!adminVerified || !adminAuthToken.trim()) {
      setProjectStatus('Verify the admin token before deleting projects.');
      return;
    }

    try {
      setProjectStatus('Deleting project...');

      const response = await fetch(apiUrl('/api/admin/projects'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminAuthToken.trim(),
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await readJsonResponse(response, 'Unable to delete project.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete project.');
      }

      setBackendProjects((currentProjects) =>
        currentProjects.filter((project) => project._id !== projectId)
      );
      setProjectStatus('Project removed from the homepage.');
    } catch (error) {
      setProjectStatus(error.message || 'Could not delete project.');
    }
  };

  const handleMessageDelete = async (messageId) => {
    if (!adminVerified || !adminAuthToken.trim()) {
      setAdminStatus('Verify the admin token before deleting messages.');
      return;
    }

    try {
      setAdminStatus('Deleting message...');

      const response = await fetch(apiUrl('/api/admin/messages'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminAuthToken.trim(),
        },
        body: JSON.stringify({ messageId }),
      });

      const data = await readJsonResponse(response, 'Unable to delete message.');

      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete message.');
      }

      setAdminMessages((currentMessages) => currentMessages.filter((message) => message._id !== messageId));
      setAdminStatus('Message removed successfully.');
    } catch (error) {
      setAdminStatus(error.message || 'Could not delete message.');
    }
  };

  const HomePage = () => (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Interior Designer Portfolio</p>
          <h1>Elegant interiors for commercial and residential spaces.</h1>
          <p className="hero-description mt-8">
            I design commercial and residential interiors with refined finishes, functional
            layouts, and a modern look that feels polished and comfortable.
          </p>

          <div className="hero-actions">
            <button className="primary-btn" type="button" onClick={() => setPage('consultation')}>
              Book consultation
            </button>
            <a className="secondary-link" href="#work">
              View work
            </a>
          </div>

          <div className="hero-summary">
            <span>3 years of experience</span>
            <span>Elegant and functional interiors</span>
          </div>
        </div>

        <div className="hero-image-wrap">
          <div className="hero-image-placeholder">
            <span>Main portfolio image</span>
          </div>
        </div>
      </section>

      <section className="work-section" id="work">
        <div className="section-head">
          <p className="section-label section-label-animated">Work</p>
          <h2 className="work-heading">
            <span>Featured</span>
            <span>Projects</span>
          </h2>
        </div>

        <div className="work-grid">
          {(backendProjects.length > 0 ? backendProjects : defaultProjects).map((project, index) => (
            <article className="work-card" key={project._id || project.name || index}>
              <div className={`work-image work-image-${index + 1}`}>
                {project.imageUrl ? (
                  <img src={project.imageUrl} alt={formatProjectField(project.name, 'Project image')} />
                ) : (
                  <span>Project image</span>
                )}
              </div>
              <div className="work-copy">
                <p>{formatProjectField(project.scope, 'Interior project')}</p>
                <h3>{formatProjectField(project.name, 'Untitled Project')}</h3>
                <span>{formatProjectField(project.note, 'View the project image.')}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="about-section" id="about">
        <div className="about-copy">
          <p className="section-label">About Me</p>
          <h2>Thoughtful interiors shaped with warmth, balance, and detail.</h2>
          <p>
            I design commercial and residential spaces that feel calm, refined, and highly usable.
            My process is centered on practical planning, clean visual language, and finishes that
            make a space feel elevated without losing comfort.
          </p>
          <div className="about-stats">
            <div className="about-stat">
              <strong>03+</strong>
              <span>Years designing interiors</span>
            </div>
            <div className="about-stat">
              <strong>Commercial</strong>
              <span>and residential projects</span>
            </div>
            <div className="about-stat">
              <strong>Refined</strong>
              <span>Layouts with warm finishes</span>
            </div>
          </div>
        </div>

        <div className="about-contact">
          <p className="about-contact-label">Let’s connect</p>
          <a href="tel:+916267301774">Phone: 6267301774</a>
          <a href="mailto:ankiisri08@gmail.com">Email: ankiisri08@gmail.com</a>
          <span className="about-contact-note">Available for consultations and project enquiries.</span>
        </div>
      </section>
    </>
  );

  const ConsultationPage = () => (
    <section className="consultation-page">
      <div className="consultation-header">
        <p className="eyebrow">Book Consultation</p>
        <h1>Schedule a consultation for your next interior project.</h1>
        <p>
          Use this page to enquire about a project, book a site visit, or start a consultation.
        </p>
      </div>

      <div className="consultation-grid">
        <div className="consultation-steps">
          <p className="section-label">How it works</p>
          <ol>
            {consultationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <form className="consultation-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" type="text" placeholder="Your full name" required />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            Project type
            <input name="projectType" type="text" placeholder="Commercial or residential" />
          </label>
          <label>
            Message
            <textarea
              name="message"
              rows="6"
              placeholder="Tell me about the space, timeline, and what you need help with."
              required
            />
          </label>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send enquiry'}
          </button>
          {formStatus ? (
            <p className="form-status" aria-live="polite">
              {formStatus}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );

  const AdminPage = () => (
    <section className="admin-page">
      <div className="admin-header">
        <p className="eyebrow">Admin</p>
        <h1>Enquiries and contact messages.</h1>
        <p>
          Use your admin token to verify access, then manage enquiries and projects. Keep the
          token private and do not place it in the frontend code.
        </p>
      </div>

      {!adminVerified ? (
        <form className="admin-toolbar" onSubmit={handleAdminVerify}>
          <label>
            Admin token
            <input ref={adminTokenRef} type="password" placeholder="Enter your admin token" />
          </label>
          <button type="submit">Verify token</button>
        </form>
      ) : (
        <div className="admin-verified-banner">
          <span>Verified</span>
          <button
            type="button"
            onClick={() => {
              setAdminVerified(false);
              setAdminAuthToken('');
              setAdminMessages([]);
                clearAdminToken();
              if (adminTokenRef.current) {
                adminTokenRef.current.value = '';
              }
              setAdminStatus('Signed out. Enter your admin token to verify access.');
            }}
          >
            Sign out
          </button>
        </div>
      )}

      <p className="admin-status">{adminStatus}</p>

      {adminVerified ? (
        <>
          <form className="admin-toolbar" onSubmit={handleAdminLoad}>
            <div className="admin-readonly-note">
              <span>Verified admin access</span>
              <small>You can load messages and manage projects now.</small>
            </div>
            <button type="submit" disabled={isLoadingMessages}>
              {isLoadingMessages ? 'Loading...' : 'Load messages'}
            </button>
          </form>

          <form className="admin-project-form" onSubmit={handleProjectSubmit}>
            <label>
              Project name
              <input name="name" type="text" placeholder="Optional" defaultValue="" />
            </label>
            <label>
              Scope
              <input
                name="scope"
                type="text"
                placeholder="Optional"
                defaultValue=""
              />
            </label>
            <label>
              Note
              <input name="note" type="text" placeholder="Optional" defaultValue="" />
            </label>
            <label>
              Image URL
              <input name="imageUrl" type="url" placeholder="https://..." defaultValue="" required />
            </label>
            <small className="admin-form-note">Only the image URL is required. The rest are optional.</small>
            <button type="submit" disabled={isSavingProject}>
              {isSavingProject ? 'Saving...' : 'Save project'}
            </button>
          </form>

          <p className="admin-status">{projectStatus}</p>

          <div className="admin-grid admin-grid-projects">
            {isLoadingProjects ? (
              <article className="admin-card">
                <p>Loading project cards...</p>
              </article>
            ) : (
              backendProjects.map((project) => (
                <article className="admin-card" key={project._id || project.name}>
                  <div className="admin-card-top">
                    <strong>{formatProjectField(project.name, 'Untitled Project')}</strong>
                    <span>{formatProjectField(project.scope, 'Interior project')}</span>
                  </div>
                  <a href={project.imageUrl || '#work'} target="_blank" rel="noreferrer">
                    {project.imageUrl || 'No image set yet'}
                  </a>
                  <p>{formatProjectField(project.note, 'No extra note added.')}</p>
                  {project._id ? (
                    <button
                      type="button"
                      className="admin-delete-btn"
                      onClick={() => handleProjectDelete(project._id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </article>
              ))
            )}
          </div>

          <form className="admin-toolbar" onSubmit={handleAdminLoad}>
            <button type="submit" disabled={isLoadingMessages}>
              {isLoadingMessages ? 'Loading...' : 'Reload messages'}
            </button>
          </form>

          <div className="admin-grid">
            {adminMessages.map((message) => (
              <article className="admin-card" key={message._id || `${message.email}-${message.createdAt}`}>
                <div className="admin-card-top">
                  <strong>{message.name}</strong>
                  <span>{message.projectType || 'General enquiry'}</span>
                </div>
                <a href={`mailto:${message.email}`}>{message.email}</a>
                <p>{message.message}</p>
                <time>
                  {message.createdAt ? new Date(message.createdAt).toLocaleString() : 'Recent message'}
                </time>
                {message._id ? (
                  <button
                    type="button"
                    className="admin-delete-btn"
                    onClick={() => handleMessageDelete(message._id)}
                  >
                    Delete
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );

  return (
    <div className="portfolio-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="portfolio-page">
        <header className="navbar">
          <button className="brand" type="button" onClick={() => setPage('home')}>
            Ankita Verma - Interior Designer
          </button>
          <nav className="nav-links">
            <button type="button" onClick={() => setPage('home')}>
              Home
            </button>
            <a href="#work">Work</a>
            <a href="#about">About me</a>
            <button className="nav-cta" type="button" onClick={() => setPage('consultation')}>
              Book consultation
            </button>
          </nav>
        </header>

        {page === 'home' ? <HomePage /> : page === 'consultation' ? <ConsultationPage /> : <AdminPage />}
      </main>
    </div>
  );
}

export default App;
