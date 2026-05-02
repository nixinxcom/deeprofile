'use client';

import { useEffect, useState } from 'react';

type PublicProfile = {
  hero: {
    name: string;
    tagline: string;
    summary: string;
    positioning: string[];
  };
  selectedProjects: {
    id: string;
    title: string;
    context: string;
    problem: string;
    action: string[];
    result: string;
  }[];
  timeline: {
    id: string;
    title: string;
    description: string;
  }[];
  capabilities: {
    id: string;
    title: string;
    description: string;
  }[];
};

export default function Home() {
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/profile/context')
      .then(res => res.json())
      .then(res => {
        setData(res.publicProfile);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <main style={{ padding: '40px', color: '#fff', background: '#0b0b0b', minHeight: '100vh' }}>
        Loading profile...
      </main>
    );
  }

  return (
    <main style={{ padding: '40px', background: '#0b0b0b', color: '#fff', minHeight: '100vh' }}>
      
      {/* HERO */}
      <section style={{ marginBottom: '60px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '10px' }}>{data.hero.name}</h1>
        <h2 style={{ fontSize: '18px', opacity: 0.7 }}>{data.hero.tagline}</h2>

        <p style={{ marginTop: '20px', maxWidth: '600px', lineHeight: '1.6' }}>
          {data.hero.summary}
        </p>

        <div style={{ marginTop: '20px' }}>
          {data.hero.positioning.map((p, i) => (
            <p key={i} style={{ opacity: 0.6 }}>{p}</p>
          ))}
        </div>
      </section>

      {/* PROJECTS */}
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{ marginBottom: '20px' }}>Selected Projects</h2>

        {data.selectedProjects.map(p => (
          <div key={p.id} style={{ marginBottom: '30px' }}>
            <h3>{p.title}</h3>
            <p><strong>Context:</strong> {p.context}</p>
            <p><strong>Problem:</strong> {p.problem}</p>

            <div>
              <strong>Action:</strong>
              <ul>
                {p.action.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            <p><strong>Result:</strong> {p.result}</p>
          </div>
        ))}
      </section>

      {/* TIMELINE */}
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{ marginBottom: '20px' }}>Professional Timeline</h2>

        {data.timeline.map(t => (
          <div key={t.id} style={{ marginBottom: '20px' }}>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
          </div>
        ))}
      </section>

      {/* CAPABILITIES */}
      <section style={{ marginBottom: '60px' }}>
        <h2 style={{ marginBottom: '20px' }}>Capabilities</h2>

        {data.capabilities.map(c => (
          <div key={c.id} style={{ marginBottom: '15px' }}>
            <strong>{c.title}</strong>
            <p style={{ opacity: 0.7 }}>{c.description}</p>
          </div>
        ))}
      </section>

      {/* AI (placeholder) */}
      <section style={{ marginTop: '80px', opacity: 0.6 }}>
        <p>Ask more about this profile (AI coming next)</p>
      </section>

    </main>
  );
}