import Link from 'next/link';

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME;

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link className="wordmark" href="/" aria-label="Back to Sentinel home">
          <span className="wordmark-mark" aria-hidden="true" />
          Sentinel
        </Link>
        <Link className="button" href="/">
          Back to product
        </Link>
      </header>

      <div className="privacy-grid">
        <aside>
          <p className="eyebrow">Privacy notice</p>
          <p>Last reviewed: 30 August 2026</p>
        </aside>
        <article className="privacy-content">
          <h1>Small form. Clear boundary.</h1>
          <p className="privacy-lede">
            This notice covers information submitted through the Sentinel pilot
            waitlist. The product workspace has its own authenticated data
            boundary.
          </p>

          <section>
            <h2>What we collect</h2>
            <p>
              The qualifier asks for your name, work email, company, and QA team
              size. Cloudflare Turnstile also processes technical signals needed
              to distinguish a person from automated abuse.
            </p>
          </section>

          <section>
            <h2>Why we collect it</h2>
            <p>
              We use the information only to review pilot fit, prevent abusive
              submissions, and personally contact selected teams. There is no
              newsletter, automated marketing sequence, or sale of waitlist data
              in this version.
            </p>
          </section>

          <section>
            <h2>How it is handled</h2>
            <p>
              Applications are stored in Sentinel under a designated owner
              organization. Authorized administrators can review a lead, update
              its pilot status, or permanently delete it. Duplicate applications
              refresh qualification details without revealing whether an email
              was already present.
            </p>
          </section>

          <section>
            <h2>Third-party services</h2>
            <p>
              Cloudflare provides the bot-verification challenge and, once the
              final walkthrough is available, its video streaming. Those
              services process data under their own terms and privacy
              commitments.
            </p>
          </section>

          <section>
            <h2>Your choices</h2>
            <p>
              You can ask for your waitlist information to be corrected or
              deleted. We do not send a confirmation email, so keep the on-page
              acceptance message for your records.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            {legalName && contactEmail ? (
              <p>
                The responsible operator is {legalName}. Privacy questions can
                be sent to <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                .
              </p>
            ) : (
              <p className="privacy-note">
                The reviewed legal identity and contact address are required
                before public launch and are intentionally not invented in this
                private preview.
              </p>
            )}
          </section>
        </article>
      </div>
    </main>
  );
}
