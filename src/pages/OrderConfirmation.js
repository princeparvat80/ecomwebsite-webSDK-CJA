import React, { useState }            from "react";
import { Link, useLocation }          from "react-router-dom";
import { pushFeedbackSubmittedEvent } from "../tracking/initDataLayer";

const OrderConfirmation = () => {
  const [feedback,    setFeedback]    = useState("");
  const [submitted,   setSubmitted]   = useState(false);
  const [rating,      setRating]      = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  const location = useLocation();
  const orderId  = location.state?.orderId || `ORDER-${Date.now()}`;
  const total    = location.state?.total;

  const handleSubmit = () => {
    if (!feedback.trim()) return;

    /* Persist locally for session reference */
    sessionStorage.setItem("userFeedback",   feedback);
    sessionStorage.setItem("feedbackRating", rating);

    /*
      pushFeedbackSubmittedEvent receives rating (1–5) and
      feedbackLength (character count). Both land in
      _aepsupport.feedback in the ACDL push for CJA analysis:
      correlate satisfaction scores with purchase value,
      product category, or UTM acquisition source.
    */
    pushFeedbackSubmittedEvent({
      rating,
      feedbackLength: feedback.trim().length,
    });

    setSubmitted(true);
  };

  return (
    <div className="confirmation-container">

      {/* PROGRESS STEPS */}
      <div className="checkout-steps" style={{ marginBottom: "40px" }}>
        <div className="checkout-step completed">
          <div className="step-dot">✓</div>
          <span>Cart</span>
        </div>
        <div className="checkout-step-line completed" />
        <div className="checkout-step completed">
          <div className="step-dot">✓</div>
          <span>Checkout</span>
        </div>
        <div className="checkout-step-line completed" />
        <div className="checkout-step active">
          <div className="step-dot">3</div>
          <span>Confirm</span>
        </div>
      </div>

      {/* SUCCESS ICON */}
      <div className="confirmation-icon">✓</div>

      <h1>Order Confirmed! 🎉</h1>

      <p>
        Thank you for shopping with us. Your order has been placed successfully
        and is being processed. You'll receive a confirmation shortly.
      </p>

      {/* ORDER ID */}
      <div className="order-id-badge">
        🧾 Order ID: {orderId}
        {total && (
          <span
            style={{
              marginLeft: "12px",
              color:      "var(--accent)",
              fontFamily: "var(--font-display)",
            }}
          >
            ${total.toFixed(2)}
          </span>
        )}
      </div>

      {/* NEXT STEPS */}
      <div
        style={{
          background:   "white",
          border:       "1px solid var(--border)",
          borderRadius: "var(--radius-xl)",
          padding:      "24px",
          marginBottom: "24px",
          textAlign:    "left",
          boxShadow:    "var(--shadow-sm)",
        }}
      >
        <h3
          style={{
            fontFamily:   "var(--font-display)",
            fontSize:     "16px",
            fontWeight:   "700",
            color:        "var(--navy)",
            marginBottom: "16px",
          }}
        >
          What happens next?
        </h3>

        {[
          { icon: "📧", title: "Confirmation", desc: "Order confirmation email sent (simulated)" },
          { icon: "📦", title: "Processing",   desc: "Your order is being prepared"              },
          { icon: "🚚", title: "Shipping",      desc: "Estimated delivery in 3–5 business days"  },
        ].map((step, i) => (
          <div
            key={i}
            style={{
              display:      "flex",
              alignItems:   "flex-start",
              gap:          "14px",
              padding:      "12px 0",
              borderBottom: i < 2 ? "1px solid var(--border)" : "none",
            }}
          >
            <div
              style={{
                width:          "36px",
                height:         "36px",
                background:     "var(--accent-light)",
                borderRadius:   "50%",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                fontSize:       "18px",
                flexShrink:     0,
              }}
            >
              {step.icon}
            </div>
            <div>
              <div
                style={{
                  fontSize:     "14px",
                  fontWeight:   "700",
                  color:        "var(--charcoal)",
                  marginBottom: "2px",
                }}
              >
                {step.title}
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                {step.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FEEDBACK SECTION */}
      <div className="feedback-section">
        <h3>How was your experience?</h3>
        <p>Your feedback helps us improve the demo and the AEP tracking implementation.</p>

        {submitted ? (
          <div className="thank-you-message">
            <span style={{ fontSize: "24px" }}>🎉</span>
            Thank you for your feedback! It's been saved.
          </div>
        ) : (
          <>
            {/* Star rating */}
            <div
              style={{
                display:        "flex",
                gap:            "6px",
                marginBottom:   "16px",
                justifyContent: "flex-start",
              }}
            >
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  style={{
                    fontSize:   "28px",
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    color:      star <= (hoveredStar || rating)
                      ? "var(--warning)"
                      : "var(--border-strong)",
                    transition: "all 0.15s ease",
                    transform:  star <= (hoveredStar || rating)
                      ? "scale(1.15)"
                      : "scale(1)",
                    lineHeight: 1,
                    padding:    "2px",
                  }}
                  aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                >
                  ★
                </button>
              ))}
              {rating > 0 && (
                <span
                  style={{
                    fontSize:  "13px",
                    color:     "var(--muted)",
                    alignSelf: "center",
                    marginLeft:"8px",
                  }}
                >
                  {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
                </span>
              )}
            </div>

            <textarea
              className="feedback-input"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Share your thoughts about this demo store…"
              maxLength={600}
            />

            <div
              style={{
                display:        "flex",
                justifyContent: "space-between",
                alignItems:     "center",
                marginTop:      "8px",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                {feedback.length}/600 characters
              </span>
              <button
                onClick={handleSubmit}
                className="submit-feedback-button"
                disabled={!feedback.trim()}
                style={{
                  opacity: feedback.trim() ? 1 : 0.5,
                  cursor:  feedback.trim() ? "pointer" : "not-allowed",
                }}
              >
                Submit Feedback ✓
              </button>
            </div>
          </>
        )}
      </div>

      {/* AEP TRACKING NOTE */}
      <div
        style={{
          background:   "var(--bg)",
          border:       "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding:      "14px 18px",
          fontSize:     "12.5px",
          color:        "var(--muted)",
          display:      "flex",
          alignItems:   "center",
          gap:          "8px",
          marginBottom: "28px",
          textAlign:    "left",
        }}
      >
        <span>📡</span>
        <span>
          <strong style={{ color: "var(--charcoal)" }}>ACDL events on this page:</strong>&nbsp;
          <code style={{ fontSize: "11px" }}>purchase</code> pushed at checkout ·&nbsp;
          <code style={{ fontSize: "11px" }}>feedback_submitted</code> pushed on submit
          with <code style={{ fontSize: "11px" }}>_aepsupport.feedback.rating</code>
        </span>
      </div>

      {/* NAVIGATION ACTIONS */}
      <div className="confirmation-actions">
        <Link to="/products" className="btn btn-primary btn-lg">
          Continue Shopping →
        </Link>
        <Link to="/" className="btn btn-secondary btn-lg">
          Go to Home
        </Link>
      </div>

    </div>
  );
};

export default OrderConfirmation;