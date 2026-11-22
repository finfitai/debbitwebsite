import Head from 'next/head'

// Branded "not found" page in the homepage's look (public/site/home.css), instead of Next.js's default.
export default function NotFound() {
  return (
    <>
      <Head>
        <title>Page not found</title>
        <meta name="robots" content="noindex" />
        <link rel="stylesheet" href="/site/home.css" />
        <link rel="stylesheet" href="/site/legal.css" />
      </Head>
      <div style={{ background: 'var(--bg)', color: 'var(--fg)', minHeight: '100vh' }}>
      <header className="legal-top">
        <div className="wrap">
          <a className="home" href="/" aria-label="debbit home"><i className="lg lg-debbit"></i></a>
        </div>
      </header>
      <main className="legal">
        <h1>We could not find that page.</h1>
        <p>The link may be old, or the address may have a typo.</p>
        <p><a className="btn" href="/">Go to the homepage</a></p>
      </main>
      </div>
    </>
  )
}
