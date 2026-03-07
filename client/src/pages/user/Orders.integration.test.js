// Dong Cheng-Yu, A0262348B
//
// Bottom-up integration tests for Orders page.
// AuthProvider (unit-tested in MS1) is the base layer and is used real.
// Orders and UserMenu are integrated on top; UserMenu navigation links are
// verified with a real MemoryRouter. Real Layout/Header/Footer render too.
// External boundaries stubbed: axios (no real server), moment (deterministic dates).

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import axios from "axios";

import Orders from "./Orders";
import { AuthProvider } from "../../context/auth";
import { CartProvider } from "../../context/cart";
import { SearchProvider } from "../../context/search";

jest.mock("axios");

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
  Toaster: () => null,
}));

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return { ...actual, useNavigate: () => jest.fn() };
});

// Stub moment so date assertions are deterministic.
jest.mock("moment", () => {
  const mockMoment = () => ({ fromNow: () => "2 days ago" });
  mockMoment.default = mockMoment;
  return { __esModule: true, default: mockMoment };
});

function seedLocalStorage({ auth = null } = {}) {
  if (auth) localStorage.setItem("auth", JSON.stringify(auth));
}

function mockAxiosGet({ orders = [], succeed = true } = {}) {
  axios.get.mockImplementation((url) => {
    if (url === "/api/v1/auth/orders") {
      return succeed
        ? Promise.resolve({ data: orders })
        : Promise.reject(new Error("network error"));
    }
    if (url === "/api/v1/category/get-category") {
      return Promise.resolve({ data: { category: [] } });
    }
    return Promise.reject(new Error(`Unhandled GET: ${url}`));
  });
}

function renderOrders(initialPath = "/dashboard/user/orders") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <SearchProvider>
          <CartProvider>
            <Routes>
              <Route path="/dashboard/user/orders" element={<Orders />} />
              <Route
                path="/dashboard/user/profile"
                element={<div data-testid="profile-page">Profile Page</div>}
              />
              <Route path="*" element={<div />} />
            </Routes>
          </CartProvider>
        </SearchProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const makeOrder = (overrides = {}) => ({
  _id: "order-1",
  status: "Processing",
  buyer: { name: "Alice" },
  createdAt: "2024-01-01T00:00:00.000Z",
  payment: { success: true },
  products: [
    {
      _id: "prod-1",
      name: "Mechanical Keyboard",
      description: "A long description that goes well beyond thirty chars",
      price: 120,
    },
  ],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("Integration – Orders: no token (guest)", () => {
  test("does not call the orders API and renders no order rows", async () => {
    // No auth seeded → AuthProvider starts with token = ""
    mockAxiosGet({ orders: [makeOrder()] });

    renderOrders();

    expect(screen.getByText("All Orders")).toBeInTheDocument();

    // Give any potential effect time to fire.
    await new Promise((r) => setTimeout(r, 50));

    expect(axios.get).not.toHaveBeenCalledWith("/api/v1/auth/orders");
    expect(screen.queryByText("Processing")).not.toBeInTheDocument();
  });
});

describe("Integration – Orders: authenticated user", () => {
  test("calls GET /api/v1/auth/orders when a valid token is present", async () => {
    seedLocalStorage({
      auth: { user: { name: "Alice" }, token: "valid-token" },
    });
    mockAxiosGet({ orders: [makeOrder()] });

    renderOrders();

    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"),
    );
  });

  test("renders order status, buyer name, relative date, and payment success", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    // Buyer name is distinct from auth user name to avoid Header collision.
    mockAxiosGet({ orders: [makeOrder({ buyer: { name: "OrderBuyer" } })] });

    renderOrders();

    const orderTable = await screen.findByRole("table");
    expect(within(orderTable).getByText("Processing")).toBeInTheDocument();
    expect(within(orderTable).getByText("OrderBuyer")).toBeInTheDocument();
    expect(within(orderTable).getByText("2 days ago")).toBeInTheDocument();
    expect(within(orderTable).getByText("Success")).toBeInTheDocument();
  });

  test("renders product count (Quantity column)", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    const order = makeOrder({
      buyer: { name: "OrderBuyer" },
      products: [makeOrder().products[0], { ...makeOrder().products[0], _id: "prod-2", name: "Mouse" }],
    });
    mockAxiosGet({ orders: [order] });

    renderOrders();

    await screen.findByText("Processing");
    // Quantity column shows products.length = 2
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  test("renders product image with correct src, truncated description, and price", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    mockAxiosGet({ orders: [makeOrder()] });

    renderOrders();

    const img = await screen.findByRole("img", { name: /Mechanical Keyboard/i });
    expect(img).toHaveAttribute(
      "src",
      "/api/v1/product/product-photo/prod-1",
    );

    // description.substring(0, 30)
    expect(
      screen.getByText("A long description that goes w"),
    ).toBeInTheDocument();

    expect(screen.getByText("Price : 120")).toBeInTheDocument();
  });

  test("renders Failed for payment.success = false", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    mockAxiosGet({
      orders: [makeOrder({ buyer: { name: "OrderBuyer" }, payment: { success: false } })],
    });

    renderOrders();

    expect(await screen.findByText("Failed")).toBeInTheDocument();
  });

  test("renders multiple orders, each numbered sequentially", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    const orders = [
      makeOrder({ _id: "o1", status: "Shipped" }),
      makeOrder({ _id: "o2", status: "Not Process" }),
    ];
    mockAxiosGet({ orders });

    renderOrders();

    expect(await screen.findByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("Not Process")).toBeInTheDocument();

    // Sequential numbering: "1" and "2" in the # column.
    const cells = screen.getAllByRole("cell");
    const numberedCells = cells.filter((c) => c.textContent === "1" || c.textContent === "2");
    expect(numberedCells.length).toBeGreaterThanOrEqual(2);
  });

  test("does not crash when the orders array is empty", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    mockAxiosGet({ orders: [] });

    renderOrders();

    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledWith("/api/v1/auth/orders"),
    );

    expect(screen.getByText("All Orders")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Integration – UserMenu navigation links", () => {
  test("renders Profile and Orders links via real UserMenu component", async () => {
    seedLocalStorage({
      auth: { user: { name: "LoggedInUser" }, token: "valid-token" },
    });
    mockAxiosGet({ orders: [] });

    renderOrders();

    const profileLink = await screen.findByRole("link", { name: /Profile/i });
    const ordersLink = screen.getByRole("link", { name: /Orders/i });

    expect(profileLink).toHaveAttribute("href", "/dashboard/user/profile");
    expect(ordersLink).toHaveAttribute("href", "/dashboard/user/orders");
  });
});
