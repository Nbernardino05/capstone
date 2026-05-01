/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import LoginPage from "../src/app/login/page";

// Module mocks
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: function Link({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) {
    return <a href={href}>{children}</a>;
  },
}));

const mockClinicianLogin = jest.fn();
jest.mock("../src/lib/api", () => ({
  clinicianLogin: (...args: any[]) => mockClinicianLogin(...args),
}));

// Setup
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

// Tests
describe("LoginPage — Clinician Authentication", () => {
  it("renders the email and password fields and the submit button", () => {
    render(<LoginPage />);

    expect(
      screen.getByPlaceholderText("clinician@example.com"),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("calls clinicianLogin with the entered email and password on submit", async () => {
    mockClinicianLogin.mockResolvedValue({
      token: "tok",
      clinician: {
        id: 1,
        name: "Dr. Smith",
        email: "doc@hospital.com",
        practice: null,
      },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByPlaceholderText("clinician@example.com"), {
      target: { value: "doc@hospital.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log in/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(mockClinicianLogin).toHaveBeenCalledWith(
        "doc@hospital.com",
        "secret123",
      );
    });
  });

  it("stores the token in localStorage and navigates to /patients on success", async () => {
    mockClinicianLogin.mockResolvedValue({
      token: "my-jwt",
      clinician: {
        id: 1,
        name: "Dr. Smith",
        email: "doc@hospital.com",
        practice: null,
      },
    });

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("clinician@example.com"), {
      target: { value: "doc@hospital.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log in/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(localStorage.getItem("clinician_token")).toBe("my-jwt");
      expect(mockPush).toHaveBeenCalledWith("/patients");
    });
  });

  it("shows an error message when login fails", async () => {
    mockClinicianLogin.mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("clinician@example.com"), {
      target: { value: "bad@email.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log in/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("clears the password field after a failed login", async () => {
    mockClinicianLogin.mockRejectedValue(new Error("Invalid credentials"));

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log in/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Password")).toHaveValue("");
    });
  });

  it("disables the submit button while a login request is in flight", async () => {
    let resolve!: (v: any) => void;
    mockClinicianLogin.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("clinician@example.com"), {
      target: { value: "doc@hospital.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "pw" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /log in/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /signing in/i }),
      ).toBeDisabled();
    });

    // Resolve the pending promise inside act so setLoading(false) is flushed cleanly
    await act(async () => {
      resolve({
        token: "tok",
        clinician: { id: 1, name: "x", email: "x", practice: null },
      });
    });
  });
});
