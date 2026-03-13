class Gen < Formula
  desc "Generate shell commands using an LLM"
  homepage "https://github.com/ryanwilsonperkin/gen"
  url "https://github.com/ryanwilsonperkin/gen/archive/refs/tags/v0.3.0.tar.gz"
  sha256 "b5b5ddea358a5b6f7efe7797065b5739cfff227a849eb6b82d13ba792280e51f"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production"
    libexec.install "bin", "node_modules", "package.json"
    (bin/"gen").write_env_script libexec/"bin/gen", PATH: "#{Formula["node"].opt_bin}:$PATH"
  end

  def caveats
    <<~EOS
      To enable tab completion, add to your shell config:

        # bash (~/.bashrc)
        eval "$(gen --shell-init bash)"

        # zsh (~/.zshrc)
        eval "$(gen --shell-init zsh)"

        # fish (~/.config/fish/config.fish)
        gen --shell-init fish | source

      Create a config file:
        mkdir -p ~/.config/gen
        cat > ~/.config/gen/genrc.json << 'EOF'
        {
          "provider": "openai",
          "api_key": "sk-...",
          "model": "gpt-4o-mini"
        }
        EOF
    EOS
  end

  test do
    assert_match "gen #{version}", shell_output("#{bin}/gen --version")
  end
end
