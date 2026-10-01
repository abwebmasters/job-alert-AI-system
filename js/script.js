/* =========================================================
   JOB ALERT+ LANDING PAGE
   Vanilla JavaScript
   ========================================================= */

"use strict";

/* ---------------------------------------------------------
   CONFIGURATION
   --------------------------------------------------------- */

const CONFIG = {
  PAYSTACK_PUBLIC_KEY: "YOUR_PAYSTACK_PUBLIC_KEY",

  // ₦2,000 = 200,000 kobo
  AMOUNT: 200000,

  CURRENCY: "NGN",

  // Replace with your actual n8n webhook endpoint.
  // This endpoint should initialize/verify the payment
  // and handle Telegram access.
  N8N_PAYMENT_WEBHOOK: "https://YOUR-N8N-DOMAIN/webhook/job-alert-payment",

  SUCCESS_URL: "/thank-you.html",
};

/* ---------------------------------------------------------
   DOM ELEMENTS
   --------------------------------------------------------- */

const paymentForm = document.querySelector("#payment-form");
const payButton = document.querySelector("#pay-button");
const paymentMessage = document.querySelector("#payment-message");

const nameInput = document.querySelector("#full-name");
const emailInput = document.querySelector("#email");
const phoneInput = document.querySelector("#phone");

const yearElement = document.querySelector("#year");

/* ---------------------------------------------------------
   FOOTER YEAR
   --------------------------------------------------------- */

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* ---------------------------------------------------------
   UI HELPERS
   --------------------------------------------------------- */

function setLoading(isLoading) {
  if (!payButton) return;

  payButton.disabled = isLoading;
  payButton.classList.toggle("is-loading", isLoading);
}

function showMessage(message, type = "error") {
  if (!paymentMessage) return;

  paymentMessage.textContent = message;

  paymentMessage.style.color = type === "success" ? "#087749" : "#b42318";
}

function clearMessage() {
  if (!paymentMessage) return;

  paymentMessage.textContent = "";
}

/* ---------------------------------------------------------
   VALIDATION
   --------------------------------------------------------- */

function validateForm() {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();

  if (!name) {
    showMessage("Please enter your full name.");
    nameInput.focus();
    return false;
  }

  if (!email) {
    showMessage("Please enter your email address.");
    emailInput.focus();
    return false;
  }

  if (!emailInput.checkValidity()) {
    showMessage("Please enter a valid email address.");
    emailInput.focus();
    return false;
  }

  return true;
}

/* ---------------------------------------------------------
   GENERATE PAYMENT REFERENCE
   --------------------------------------------------------- */

function generateReference() {
  const timestamp = Date.now();

  const random = Math.random().toString(36).substring(2, 9);

  return `JOBALERT-${timestamp}-${random}`.toUpperCase();
}

/* ---------------------------------------------------------
   DIRECT PAYSTACK CHECKOUT
   ---------------------------------------------------------
   
   This is useful for testing.

   IMPORTANT:
   For production, use your n8n backend to initialize
   the transaction and verify payment before granting
   Telegram access.
--------------------------------------------------------- */

function startPaystackCheckout() {
  if (typeof PaystackPop === "undefined" && typeof Paystack === "undefined") {
    showMessage("Payment system is still loading. Please try again.");

    return;
  }

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();

  const nameParts = name.split(/\s+/);

  const firstName = nameParts.shift() || "";
  const lastName = nameParts.join(" ") || "";

  const reference = generateReference();

  /*
   * Paystack Popup V2
   */

  const popup = new PaystackPop();

  popup.newTransaction({
    key: CONFIG.PAYSTACK_PUBLIC_KEY,

    email: email,

    amount: CONFIG.AMOUNT,

    currency: CONFIG.CURRENCY,

    reference: reference,

    firstName: firstName,

    lastName: lastName,

    phone: phone,

    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: name,
        },

        {
          display_name: "WhatsApp",
          variable_name: "whatsapp",
          value: phone || "Not provided",
        },

        {
          display_name: "Product",
          variable_name: "product",
          value: "Job Alert+ Monthly Access",
        },
      ],
    },

    onLoad: function () {
      clearMessage();
    },

    onSuccess: async function (transaction) {
      showMessage("Payment received. Verifying your access...", "success");

      /*
       * DO NOT grant Telegram access based only
       * on this frontend callback.
       *
       * Send the reference to your backend/n8n,
       * verify the payment with Paystack, then
       * grant Telegram access.
       */

      try {
        const result = await verifyWithBackend({
          reference: transaction.reference,
          name,
          email,
          phone,
        });

        if (result.success) {
          window.location.href = result.redirect_url || CONFIG.SUCCESS_URL;

          return;
        }

        showMessage("Payment received, but verification is still processing. Please wait a moment.", "success");
      } catch (error) {
        console.error(error);

        showMessage("Payment received. Your access is being processed. Please check your email shortly.", "success");
      } finally {
        setLoading(false);
      }
    },

    onCancel: function () {
      setLoading(false);

      showMessage("Payment was cancelled. You can try again whenever you're ready.");
    },

    onError: function (error) {
      console.error("Paystack error:", error);

      setLoading(false);

      showMessage("We couldn't open the payment window. Please try again.");
    },
  });
}

/* ---------------------------------------------------------
   N8N BACKEND VERIFICATION
   --------------------------------------------------------- */

async function verifyWithBackend(customerData) {
  /*
   * IMPORTANT:
   *
   * Replace CONFIG.N8N_PAYMENT_WEBHOOK with your
   * actual n8n webhook URL.
   *
   * Your n8n workflow should:
   *
   * 1. Receive the Paystack reference.
   * 2. Verify it with Paystack.
   * 3. Confirm:
   *      - status = success
   *      - amount = 200000
   *      - currency = NGN
   * 4. Store customer/payment information.
   * 5. Grant Telegram access.
   * 6. Return success.
   */

  if (!CONFIG.N8N_PAYMENT_WEBHOOK || CONFIG.N8N_PAYMENT_WEBHOOK.includes("YOUR-N8N-DOMAIN")) {
    /*
     * Development fallback.
     *
     * Remove this once your n8n webhook is connected.
     */

    return {
      success: true,
      redirect_url: CONFIG.SUCCESS_URL,
    };
  }

  const response = await fetch(CONFIG.N8N_PAYMENT_WEBHOOK, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return await response.json();
}

/* ---------------------------------------------------------
   PAYMENT FORM
   --------------------------------------------------------- */

if (paymentForm) {
  paymentForm.addEventListener("submit", function (event) {
    event.preventDefault();

    clearMessage();

    if (!validateForm()) {
      return;
    }

    if (!CONFIG.PAYSTACK_PUBLIC_KEY || CONFIG.PAYSTACK_PUBLIC_KEY.includes("YOUR_")) {
      showMessage("Payment is not configured yet. Please contact support.");

      return;
    }

    setLoading(true);

    startPaystackCheckout();
  });
}
