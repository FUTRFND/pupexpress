import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, LegalSection, LegalList } from "@/components/info/legal-page";

const EFFECTIVE_DATE = "June 5, 2026";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PupXpress" },
      {
        name: "description",
        content:
          "The terms governing your use of the PupXpress (Dogeride) app and services operated by Dogeride Technologies Inc.",
      },
      { property: "og:title", content: "Terms of Service — PupXpress" },
      {
        property: "og:description",
        content: "The terms governing your use of PupXpress.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate={EFFECTIVE_DATE}
      intro={
        <>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) form a binding
            agreement between you and Dogeride Technologies Inc
            (&ldquo;Dogeride,&rdquo; &ldquo;PupXpress,&rdquo; &ldquo;we,&rdquo;
            &ldquo;us,&rdquo; or &ldquo;our&rdquo;) governing your access to and
            use of the PupXpress (also marketed as Dogeride) mobile application,
            websites, and related services (collectively, the
            &ldquo;Services&rdquo;).
          </p>
          <p className="font-medium text-foreground">
            Please read these Terms carefully. They include an arbitration
            agreement and class-action waiver (Section 14) and important
            limitations of liability (Section 12). By creating an account or
            using the Services, you agree to these Terms.
          </p>
        </>
      }
    >
      <LegalSection title="1. The PupXpress platform">
        <p>
          PupXpress is a technology platform that connects pet owners
          (&ldquo;Riders&rdquo;) who need transportation for their dogs with
          independent third-party drivers (&ldquo;Drivers&rdquo;) who provide
          those transportation services. Dogeride is not a transportation
          carrier and does not provide transportation services. Drivers are
          independent contractors and not employees, agents, or partners of
          Dogeride. We are not responsible for the acts or omissions of any
          Rider or Driver.
        </p>
      </LegalSection>

      <LegalSection title="2. Eligibility and accounts">
        <LegalList
          items={[
            "You must be at least 18 years old and able to form a binding contract to use the Services.",
            "You must provide accurate, current, and complete information and keep it updated.",
            "You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.",
            "Drivers must additionally hold a valid driver's license, maintain a registered and insured vehicle, and pass any required background and document checks.",
            "We may refuse, suspend, or terminate accounts at our discretion, including for safety, fraud, or policy violations.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Bookings, fares, and payments">
        <LegalList
          items={[
            "Fares are calculated based on factors such as distance, time, and applicable fees, and are estimated before you book. Final fares may vary based on actual route, waiting time, and other conditions.",
            "Dogeride charges a platform service fee on transactions. Fees and pricing may change and will be disclosed in the app.",
            "You authorize us and our payment processor to charge your selected payment method for fares, tips, fees, tolls, and applicable taxes.",
            "Tips are optional and, where offered, are passed through to the Driver.",
            "Refunds, adjustments, and cancellation fees are handled in accordance with our policies disclosed in the app. Cancellation fees may apply if you cancel after a Driver has been assigned or is en route.",
            "Promotional credits and referral rewards are subject to their stated terms, have no cash value, and may be modified or revoked if obtained through misuse.",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Rider responsibilities">
        <LegalList
          items={[
            "Provide accurate pickup and drop-off information and ensure someone is available to hand off and receive your pet if required.",
            "Disclose accurate information about your dog, including size, temperament, health conditions, and any special handling needs.",
            "Ensure your dog is vaccinated, leashed or crated as appropriate, and fit to travel.",
            "You are responsible for your dog's behavior and for any damage, injury, or cleaning costs caused by your pet.",
            "Treat Drivers and their vehicles with respect and comply with all community and safety guidelines.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Driver responsibilities">
        <LegalList
          items={[
            "Maintain all licenses, registrations, and insurance required by law and operate a safe, roadworthy vehicle.",
            "Transport pets safely and humanely and follow reasonable care instructions provided by the Rider.",
            "Comply with all applicable traffic, animal-transport, and local laws.",
            "Provide accurate location and trip status and not engage in fraudulent, unsafe, or discriminatory conduct.",
            "As independent contractors, Drivers are solely responsible for their taxes and for determining how and when to provide services.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Animal welfare and assumption of risk">
        <p>
          Transporting animals carries inherent risks. While we promote safety,
          you acknowledge that Dogeride does not supervise rides and cannot
          guarantee the conduct of any Rider or Driver. To the fullest extent
          permitted by law, you assume the risks associated with using the
          Services, including risks to your pet, and you are responsible for
          evaluating whether a ride is appropriate for your animal.
        </p>
      </LegalSection>

      <LegalSection title="7. Prohibited conduct">
        <LegalList
          items={[
            "Violating any law or the rights of others, including animal-cruelty or anti-discrimination laws.",
            "Harassment, threats, violence, or abusive behavior toward any person or animal.",
            "Providing false information, impersonating others, or attempting to manipulate fares, ratings, or referrals.",
            "Circumventing the platform to arrange or pay for rides off-app to avoid fees.",
            "Interfering with, reverse-engineering, scraping, or attempting to gain unauthorized access to the Services.",
            "Using the Services to transport anything other than the pets and items permitted by these Terms.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. User content">
        <p>
          You retain ownership of content you submit (such as photos, reviews,
          and messages). You grant Dogeride a worldwide, non-exclusive,
          royalty-free license to use, host, store, reproduce, and display that
          content to operate and improve the Services. You are responsible for
          your content and represent that you have the rights necessary to
          provide it.
        </p>
      </LegalSection>

      <LegalSection title="9. Intellectual property">
        <p>
          The Services, including all software, designs, logos, and trademarks,
          are owned by Dogeride or its licensors and are protected by
          intellectual-property laws. We grant you a limited, revocable,
          non-transferable license to use the Services for their intended
          purpose. All rights not expressly granted are reserved.
        </p>
      </LegalSection>

      <LegalSection title="10. Third-party services">
        <p>
          The Services integrate third-party services such as payment
          processing, mapping and navigation, and authentication. Your use of
          those services may be subject to their own terms and privacy
          policies. We are not responsible for third-party services.
        </p>
      </LegalSection>

      <LegalSection title="11. Disclaimers">
        <p>
          THE SERVICES ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS,
          IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO
          NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR
          ERROR-FREE, OR THAT ANY RIDER OR DRIVER WILL MEET YOUR EXPECTATIONS.
        </p>
      </LegalSection>

      <LegalSection title="12. Limitation of liability">
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, DOGERIDE AND ITS OFFICERS,
          DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS
          OF PROFITS, DATA, GOODWILL, OR INJURY TO PERSONS OR ANIMALS, ARISING
          OUT OF OR RELATING TO YOUR USE OF THE SERVICES. OUR TOTAL LIABILITY
          FOR ANY CLAIM RELATING TO THE SERVICES WILL NOT EXCEED THE GREATER OF
          THE AMOUNTS YOU PAID TO US IN THE SIX MONTHS BEFORE THE EVENT GIVING
          RISE TO THE CLAIM OR ONE HUNDRED U.S. DOLLARS ($100). SOME
          JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO SOME OF THESE MAY
          NOT APPLY TO YOU.
        </p>
      </LegalSection>

      <LegalSection title="13. Indemnification">
        <p>
          You agree to indemnify, defend, and hold harmless Dogeride and its
          affiliates from and against any claims, liabilities, damages, losses,
          and expenses (including reasonable legal fees) arising out of or
          related to your use of the Services, your content, your pet, your
          violation of these Terms, or your violation of any law or the rights
          of a third party.
        </p>
      </LegalSection>

      <LegalSection title="14. Dispute resolution and arbitration">
        <p>
          Except where prohibited by law, you and Dogeride agree to resolve any
          dispute arising out of or relating to these Terms or the Services
          through binding individual arbitration rather than in court, and you
          waive the right to participate in a class action or representative
          proceeding. You may opt out of arbitration within 30 days of first
          accepting these Terms by emailing support@pupxpress.com with your name
          and a statement that you wish to opt out. This section does not
          prevent either party from seeking relief in small-claims court for
          qualifying claims.
        </p>
      </LegalSection>

      <LegalSection title="15. Termination">
        <p>
          You may stop using the Services and close your account at any time. We
          may suspend or terminate your access to the Services at any time, with
          or without notice, for any reason, including violation of these Terms.
          Sections that by their nature should survive termination (including
          payment obligations, disclaimers, limitations of liability,
          indemnification, and dispute resolution) will survive.
        </p>
      </LegalSection>

      <LegalSection title="16. Governing law">
        <p>
          These Terms are governed by the laws of the State of Colorado, without
          regard to its conflict-of-laws rules. Subject to the arbitration
          provision, the exclusive venue for any disputes will be the state and
          federal courts located in Denver, Colorado.
        </p>
      </LegalSection>

      <LegalSection title="17. Changes to these Terms">
        <p>
          We may modify these Terms from time to time. We will post the updated
          Terms with a new effective date and, where appropriate, provide
          additional notice. Your continued use of the Services after an update
          constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection title="18. Contact us">
        <p>
          Questions about these Terms can be sent to support@pupxpress.com or by
          mail to the address below.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
