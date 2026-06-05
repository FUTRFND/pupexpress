import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection, LegalList } from "@/components/info/legal-page";

const EFFECTIVE_DATE = "June 5, 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PupXpress" },
      {
        name: "description",
        content:
          "How Dogeride Technologies Inc collects, uses, shares, and protects your information when you use the PupXpress (Dogeride) app.",
      },
      { property: "og:title", content: "Privacy Policy — PupXpress" },
      {
        property: "og:description",
        content:
          "How we collect, use, and protect your information on PupXpress.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <>
          <p>
            This Privacy Policy explains how Dogeride Technologies Inc
            (&ldquo;Dogeride,&rdquo; &ldquo;PupXpress,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, discloses,
            and safeguards information about you when you use the PupXpress
            (also marketed as Dogeride) mobile application, websites, and
            related services (collectively, the &ldquo;Services&rdquo;).
          </p>
          <p>
            By creating an account or using the Services, you acknowledge that
            you have read and understood this Privacy Policy. If you do not
            agree, please do not use the Services.
          </p>
        </>
      }
    >
      <LegalSection title="1. Information we collect">
        <p>We collect the following categories of information:</p>
        <p className="font-medium text-foreground">Information you provide</p>
        <LegalList
          items={[
            "Account details such as your name, email address, phone number, password, and profile photo.",
            "Pet information including your dog's name, breed, size, age, temperament notes, and care instructions.",
            "Payment information processed through our third-party payment processor (we do not store full card numbers).",
            "Driver information, where applicable, including driver's license, vehicle details, insurance documents, background-check authorization, and payout account details.",
            "Communications you send to us or to other users through in-app messaging and support requests.",
            "Ratings, reviews, referral codes, and other content you submit.",
          ]}
        />
        <p className="font-medium text-foreground">
          Information collected automatically
        </p>
        <LegalList
          items={[
            "Precise and approximate location data (with your permission) to match riders and drivers, display nearby drivers, calculate fares, provide navigation, and enable live trip tracking.",
            "Device and usage data such as device model, operating system, app version, IP address, identifiers, and interactions with the app.",
            "Trip data including pickup and drop-off points, routes, distance, duration, timestamps, and fare details.",
            "Cookies and similar technologies on our websites.",
          ]}
        />
        <p className="font-medium text-foreground">
          Information from third parties
        </p>
        <LegalList
          items={[
            "Authentication providers (e.g., Google) when you sign in with them.",
            "Background-check and identity-verification providers for drivers.",
            "Payment processors confirming transactions and payout status.",
            "Mapping and routing providers used to estimate fares and arrival times.",
          ]}
        />
      </LegalSection>

      <LegalSection title="2. How we use your information">
        <LegalList
          items={[
            "Provide, operate, maintain, and improve the Services, including matching riders with drivers and processing rides for pets.",
            "Process payments, payouts, tips, refunds, and platform fees.",
            "Enable location-based features such as nearby drivers, ETAs, and live tracking.",
            "Verify driver eligibility, run background checks, and maintain safety and trust on the platform.",
            "Communicate with you about bookings, receipts, support, security alerts, and service updates.",
            "Send promotional messages and referral offers where permitted (you may opt out).",
            "Detect, prevent, and address fraud, abuse, safety incidents, and violations of our Terms.",
            "Comply with legal obligations and enforce our agreements.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How we share your information">
        <p>We share information only as described below. We do not sell your personal information.</p>
        <LegalList
          items={[
            "Between riders and drivers: limited details needed to complete a ride (e.g., first name, photo, approximate location, vehicle details, and pet care notes). Exact home addresses and contact details are masked where feasible.",
            "Service providers and processors: payment processing, cloud hosting, mapping/routing, analytics, identity verification, background checks, push-notification delivery, and customer support.",
            "Legal and safety: to comply with applicable law, legal process, or governmental requests, and to protect the rights, property, and safety of users, the public, or Dogeride.",
            "Business transfers: in connection with a merger, acquisition, financing, or sale of assets, subject to this Privacy Policy.",
            "With your consent: for any other purpose disclosed at the time of collection.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Location data">
        <p>
          The Services rely on location data to function. With your permission,
          we collect location while you use the app and, where you enable it,
          in the background so drivers and riders can be matched and trips can
          be tracked in real time. You can disable location access at any time
          through your device settings, but some features will not work without
          it.
        </p>
      </LegalSection>

      <LegalSection title="5. Your choices and rights">
        <LegalList
          items={[
            "Access, update, or delete your account information from within the app or by contacting us.",
            "Opt out of promotional communications using the unsubscribe link or in-app settings.",
            "Manage location, notification, and tracking permissions through your device settings.",
            "Depending on your jurisdiction (including residents of California, Colorado, and the EEA/UK), you may have rights to access, correct, delete, restrict, or port your personal data, and to object to certain processing. To exercise these rights, contact us at support@pupxpress.com. We will not discriminate against you for exercising your rights.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>
          We retain personal information for as long as your account is active
          and as needed to provide the Services, comply with legal, tax, and
          accounting obligations, resolve disputes, prevent fraud, and enforce
          our agreements. When information is no longer needed, we delete or
          anonymize it.
        </p>
      </LegalSection>

      <LegalSection title="7. Security">
        <p>
          We use administrative, technical, and physical safeguards designed to
          protect your information, including encryption in transit, access
          controls, and row-level security on our databases. No method of
          transmission or storage is completely secure, and we cannot guarantee
          absolute security.
        </p>
      </LegalSection>

      <LegalSection title="8. Children's privacy">
        <p>
          The Services are not directed to children under 18, and we do not
          knowingly collect personal information from them. If you believe a
          child has provided us with personal information, contact us and we
          will take appropriate steps to delete it.
        </p>
      </LegalSection>

      <LegalSection title="9. International users">
        <p>
          We are based in the United States and process information there. If
          you access the Services from outside the United States, you consent to
          the transfer and processing of your information in the United States
          and other countries that may have different data-protection laws than
          your own.
        </p>
      </LegalSection>

      <LegalSection title="10. Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. We will post the
          updated version with a new effective date and, where appropriate,
          provide additional notice. Your continued use of the Services after an
          update constitutes acceptance of the revised policy.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact us">
        <p>
          If you have questions or requests regarding this Privacy Policy or
          your information, contact us at support@pupxpress.com or by mail at the
          address below.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
