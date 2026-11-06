document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("regEmail").value.trim();
            const password = document.getElementById("regPassword").value;

            if (!name || !email || !password) {
                alert("Please fill in all fields.");
                return;
            }
            if (password.length < 6) {
                alert("Password must contain at least 6 characters.");
                return;
            }

            await submitForm(registerForm, "/register", { name, email, password }, "Unable to connect to the server.");
        });
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;
            if (!email || !password) {
                alert("Please enter your email and password.");
                return;
            }
            await submitForm(loginForm, "/login", { email, password }, "Unable to connect to the server.");
        });
    }

    const authLink = document.getElementById("authLink");
    const nav = document.querySelector(".nav-links");
    if (authLink && nav) {
        fetch("/api/me", { cache: "no-store" })
            .then((response) => response.json())
            .then((state) => {
                if (!state.loggedIn) return;
                authLink.textContent = `Hi, ${state.user.name}`;
                authLink.removeAttribute("href");

                const logoutLink = document.createElement("a");
                logoutLink.href = "#";
                logoutLink.className = "login";
                logoutLink.textContent = "Log out";
                logoutLink.addEventListener("click", async (event) => {
                    event.preventDefault();
                    await fetch("/logout", { method: "POST" });
                    window.location.assign("/");
                });
                nav.insertBefore(logoutLink, authLink.nextSibling);
            })
            .catch(() => {});
    }
});

async function submitForm(form, endpoint, data, connectionError) {
    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        alert(result.message);
        if (response.ok) {
            form.reset();
            window.location.assign("/");
        }
    } catch (error) {
        alert(connectionError);
    }
}
