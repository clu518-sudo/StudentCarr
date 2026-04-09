import request from "supertest";
import app from "../src/app.js";
import prisma from "../src/lib/prisma.js";

const agent = request.agent(app);

describe("Auth flow", () => {
  const email = `user_${Date.now()}@example.com`;
  const password = "StrongPass123!";
  let accessToken;

  afterAll(async () => {
    await prisma.authSession.deleteMany();
    await prisma.authAuditLog.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it("signs up a user", async () => {
    const response = await agent.post("/api/auth/signup").send({
      email,
      password,
      fullName: "Test User",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.headers["set-cookie"]).toBeDefined();
    accessToken = response.body.data.accessToken;
  });

  it("returns current user", async () => {
    const response = await agent
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
  });

  it("logs out and blocks old refresh token", async () => {
    const logoutResponse = await agent.post("/api/auth/logout");
    expect(logoutResponse.status).toBe(200);

    const refreshResponse = await agent.post("/api/auth/refresh");
    expect(refreshResponse.status).toBe(401);
  });

  it("logs in and refreshes token", async () => {
    const loginResponse = await agent.post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);

    const refreshResponse = await agent.post("/api/auth/refresh");
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.success).toBe(true);
    expect(refreshResponse.body.data.accessToken).toBeDefined();
  });
});
