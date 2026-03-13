class Gen < Formula
  desc "Generate shell commands using an LLM"
  homepage "https://github.com/ryanwilsonperkin/gen"
  url "https://github.com/ryanwilsonperkin/gen/archive/refs/tags/v0.2.0.tar.gz"
  sha256 "119c4e57bb66565e8f94d3b0ed9902b5e740f10bcb006b91230c7e1195306b5b"
  license "MIT"

  depends_on "curl"
  depends_on "jq"

  def install
    bin.install "bin/gen"
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
